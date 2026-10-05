using System.Data.Common;
using System.Security.Claims;
using System.Text.Json;
using INNO.One.Contracts.Automation;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Workflows.Application;
using INNO.One.Modules.Workflows.Domain;
using INNO.One.Modules.Workflows.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace INNO.One.Modules.Workflows.Infrastructure;

public sealed class WorkflowExecutionWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<WorkflowExecutionWorker> logger) : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ResetInterruptedRunsAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var processed = await ProcessNextAsync(stoppingToken);
                if (!processed)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(500), stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Automation execution worker iteration failed.");
                await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
            }
        }
    }

    private async Task ResetInterruptedRunsAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<WorkflowsDbContext>();
        var now = DateTimeOffset.UtcNow;

        var runs = await db.WorkflowRuns
            .Where(x => x.Status == "running" && x.CompletedAt == null)
            .ToListAsync(cancellationToken);

        if (runs.Count == 0)
        {
            return;
        }

        var runIds = runs.Select(x => x.Id).ToArray();
        var interruptedSteps = await db.WorkflowRunSteps
            .Where(x => runIds.Contains(x.RunId) && x.Status == "running")
            .ToListAsync(cancellationToken);

        foreach (var step in interruptedSteps)
        {
            step.Status = "interrupted";
            step.ErrorCode = "WORKER_INTERRUPTED";
            step.ErrorDetail = "The worker stopped before the node result was persisted.";
            step.CompletedAt = now;
        }

        foreach (var run in runs)
        {
            run.Status = "queued";
            run.ActiveNodeIdsJson = "[]";
            run.NextAttemptAt = now;
            run.UpdatedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<bool> ProcessNextAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<WorkflowsDbContext>();
        var ledger = scope.ServiceProvider.GetRequiredService<WorkflowLedgerWriter>();
        var accessEvaluator = scope.ServiceProvider.GetRequiredService<IAccessEvaluator>();
        var executors = scope.ServiceProvider.GetServices<IAutomationNodeExecutor>().ToList();
        var now = DateTimeOffset.UtcNow;

        var run = await db.WorkflowRuns
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(
                x => (x.Status == "queued" || x.Status == "waiting")
                    && (!x.NextAttemptAt.HasValue || x.NextAttemptAt <= now),
                cancellationToken);

        if (run is null)
        {
            return false;
        }

        if (run.Status == "waiting")
        {
            await ResumeWaitingRunAsync(run, db, cancellationToken);
            return true;
        }

        var firstStart = !run.StartedAt.HasValue;
        run.Status = "running";
        run.StartedAt ??= now;
        run.NextAttemptAt = null;
        run.ErrorCode = null;
        run.ErrorDetail = null;
        run.UpdatedAt = now;

        if (firstStart)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await AppendRunLifecycleAsync(
                run,
                ledger,
                "started",
                new { run.WorkflowVersion, run.AttemptCount },
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        else
        {
            await db.SaveChangesAsync(cancellationToken);
        }

        var managePermission = ManagePermission(run.OwnerModule);
        if (managePermission is null)
        {
            await FailRunAsync(
                run,
                db,
                ledger,
                "AUTOMATION_OWNER_NOT_SUPPORTED",
                null,
                "No execution permission contract exists for owner module '" + run.OwnerModule + "'.",
                cancellationToken);
            return true;
        }

        var principal = Principal(run.RequestedBySubject);
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            managePermission,
            cancellationToken);

        if (!access.Allowed || access.UserId != run.RequestedByUserId)
        {
            await FailRunAsync(
                run,
                db,
                ledger,
                "AUTOMATION_PERMISSION_REVOKED",
                null,
                "The requesting actor no longer has permission to execute this automation.",
                cancellationToken);
            return true;
        }

        if (!TrySnapshotGraph(
                run.DefinitionSnapshotJson,
                out var nodesJson,
                out var edgesJson,
                out var snapshotError))
        {
            await FailRunAsync(
                run,
                db,
                ledger,
                "AUTOMATION_SNAPSHOT_INVALID",
                null,
                snapshotError,
                cancellationToken);
            return true;
        }

        if (!WorkflowExecutionPlanner.TryCreate(
                run.OwnerModule,
                nodesJson,
                edgesJson,
                executors,
                out var plan,
                out var planErrorCode,
                out var planErrorDetail)
            || plan is null)
        {
            await FailRunAsync(
                run,
                db,
                ledger,
                planErrorCode ?? "AUTOMATION_NOT_EXECUTABLE",
                null,
                planErrorDetail,
                cancellationToken);
            return true;
        }

        var completed = DeserializeIds(run.CompletedNodeIdsJson);

        foreach (var node in plan.Nodes)
        {
            if (completed.Contains(node.Id))
            {
                continue;
            }

            run.ActiveNodeIdsJson = JsonSerializer.Serialize(new[] { node.Id });
            run.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);

            if (node.Kind == "trigger" || node.Kind == "end")
            {
                await RecordCoreSuccessAsync(run, node, db, cancellationToken);
                completed.Add(node.Id);
                run.CompletedNodeIdsJson = JsonSerializer.Serialize(completed);
                run.ActiveNodeIdsJson = "[]";
                run.UpdatedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                continue;
            }

            if (node.Kind == "wait")
            {
                var durationSeconds = WaitDurationSeconds(node.Configuration);
                if (durationSeconds is null)
                {
                    await FailRunAsync(
                        run,
                        db,
                        ledger,
                        "AUTOMATION_WAIT_INVALID",
                        node.Id,
                        "Wait duration must be between 0 and 300 seconds.",
                        cancellationToken);
                    return true;
                }

                if (durationSeconds.Value == 0)
                {
                    await RecordCoreSuccessAsync(run, node, db, cancellationToken);
                    completed.Add(node.Id);
                    run.CompletedNodeIdsJson = JsonSerializer.Serialize(completed);
                    run.ActiveNodeIdsJson = "[]";
                    run.UpdatedAt = DateTimeOffset.UtcNow;
                    await db.SaveChangesAsync(cancellationToken);
                    continue;
                }

                var waitAttempt = await NextNodeAttempt(
                    db,
                    run.Id,
                    node.Id,
                    cancellationToken);
                var step = new WorkflowRunStep
                {
                    Id = Guid.NewGuid(),
                    RunId = run.Id,
                    NodeId = node.Id,
                    NodeKind = node.Kind,
                    CatalogKey = node.CatalogKey,
                    Status = "waiting",
                    Attempt = waitAttempt,
                    StartedAt = DateTimeOffset.UtcNow,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                db.WorkflowRunSteps.Add(step);
                run.Status = "waiting";
                run.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(durationSeconds.Value);
                run.UpdatedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                return true;
            }

            var executor = executors.FirstOrDefault(x =>
                string.Equals(x.OwnerModule, run.OwnerModule, StringComparison.OrdinalIgnoreCase)
                && x.Supports(node.CatalogKey));

            if (executor is null)
            {
                await FailRunAsync(
                    run,
                    db,
                    ledger,
                    "AUTOMATION_NODE_NOT_EXECUTABLE",
                    node.Id,
                    "No module executor is registered for '" + node.CatalogKey + "'.",
                    cancellationToken);
                return true;
            }

            var nodeAttempt = await NextNodeAttempt(db, run.Id, node.Id, cancellationToken);
            var startedAt = DateTimeOffset.UtcNow;
            var stepRow = new WorkflowRunStep
            {
                Id = Guid.NewGuid(),
                RunId = run.Id,
                NodeId = node.Id,
                NodeKind = node.Kind,
                CatalogKey = node.CatalogKey,
                Status = "running",
                Attempt = nodeAttempt,
                StartedAt = startedAt,
                CreatedAt = startedAt
            };
            db.WorkflowRunSteps.Add(stepRow);
            await db.SaveChangesAsync(cancellationToken);

            AutomationNodeExecutionResult result;
            try
            {
                using var inputDocument = JsonDocument.Parse(run.InputJson);
                result = await executor.ExecuteAsync(
                    new AutomationNodeExecutionContext(
                        run.OwnerModule,
                        run.Id,
                        run.WorkflowId,
                        run.WorkflowVersion,
                        node.Id,
                        node.Kind,
                        node.CatalogKey,
                        node.Configuration,
                        inputDocument.RootElement.Clone(),
                        run.RequestedByUserId,
                        run.RequestedBySubject,
                        run.CorrelationId,
                        run.TraceId,
                        nodeAttempt),
                    cancellationToken);
            }
            catch (Exception ex) when (ex is DbException or TimeoutException)
            {
                logger.LogWarning(ex,
                    "Automation run {RunId} node {NodeId} hit a transient infrastructure failure.",
                    run.Id,
                    node.Id);
                result = AutomationNodeExecutionResult.Failure(
                    "AUTOMATION_TRANSIENT_FAILURE",
                    "A transient infrastructure failure interrupted the node.",
                    retryable: true);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex,
                    "Automation run {RunId} node {NodeId} failed unexpectedly.",
                    run.Id,
                    node.Id);
                result = AutomationNodeExecutionResult.Failure(
                    "AUTOMATION_NODE_FAILED",
                    "The node failed unexpectedly.");
            }

            stepRow.CompletedAt = DateTimeOffset.UtcNow;
            if (result.Succeeded)
            {
                stepRow.Status = "completed";
                stepRow.OutputJson = result.Output?.GetRawText();
                await db.SaveChangesAsync(cancellationToken);

                completed.Add(node.Id);
                run.CompletedNodeIdsJson = JsonSerializer.Serialize(completed);
                run.ActiveNodeIdsJson = "[]";
                run.UpdatedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                continue;
            }

            stepRow.Status = "failed";
            stepRow.ErrorCode = result.ErrorCode;
            stepRow.ErrorDetail = result.ErrorDetail;
            await db.SaveChangesAsync(cancellationToken);

            if (result.Retryable && nodeAttempt < run.MaxAttempts)
            {
                run.AttemptCount = Math.Max(run.AttemptCount + 1, nodeAttempt + 1);
                run.Status = "queued";
                run.ActiveNodeIdsJson = "[]";
                run.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(RetryDelaySeconds(nodeAttempt));
                run.ErrorCode = result.ErrorCode;
                run.ErrorDetail = result.ErrorDetail;
                run.UpdatedAt = DateTimeOffset.UtcNow;

                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                await db.SaveChangesAsync(cancellationToken);
                await AppendRunLifecycleAsync(
                    run,
                    ledger,
                    "retry_scheduled",
                    new
                    {
                        nodeId = node.Id,
                        nodeAttempt,
                        nextAttemptAt = run.NextAttemptAt,
                        errorCode = result.ErrorCode
                    },
                    cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return true;
            }

            await FailRunAsync(
                run,
                db,
                ledger,
                result.ErrorCode ?? "AUTOMATION_NODE_FAILED",
                node.Id,
                result.ErrorDetail,
                cancellationToken);
            return true;
        }

        run.Status = "completed";
        run.ActiveNodeIdsJson = "[]";
        run.FailedNodeId = null;
        run.ErrorCode = null;
        run.ErrorDetail = null;
        run.CompletedAt = DateTimeOffset.UtcNow;
        run.UpdatedAt = run.CompletedAt.Value;

        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
        {
            await db.SaveChangesAsync(cancellationToken);
            await AppendRunLifecycleAsync(
                run,
                ledger,
                "completed",
                new
                {
                    run.WorkflowVersion,
                    completedNodeCount = completed.Count,
                    durationMs = run.StartedAt.HasValue
                        ? (long)(run.CompletedAt.Value - run.StartedAt.Value).TotalMilliseconds
                        : 0
                },
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        return true;
    }

    private static async Task ResumeWaitingRunAsync(
        WorkflowRun run,
        WorkflowsDbContext db,
        CancellationToken cancellationToken)
    {
        var active = DeserializeIds(run.ActiveNodeIdsJson);
        var nodeId = active.FirstOrDefault();
        if (nodeId is null)
        {
            run.Status = "queued";
            run.NextAttemptAt = null;
            run.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        var step = await db.WorkflowRunSteps
            .Where(x => x.RunId == run.Id
                && x.NodeId == nodeId
                && x.Status == "waiting")
            .OrderByDescending(x => x.Attempt)
            .FirstOrDefaultAsync(cancellationToken);

        if (step is null)
        {
            run.Status = "queued";
            run.NextAttemptAt = null;
            run.ActiveNodeIdsJson = "[]";
            run.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        step.Status = "completed";
        step.CompletedAt = DateTimeOffset.UtcNow;

        var completed = DeserializeIds(run.CompletedNodeIdsJson);
        completed.Add(nodeId);
        run.CompletedNodeIdsJson = JsonSerializer.Serialize(completed);
        run.ActiveNodeIdsJson = "[]";
        run.Status = "queued";
        run.NextAttemptAt = null;
        run.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task RecordCoreSuccessAsync(
        WorkflowRun run,
        WorkflowExecutionNode node,
        WorkflowsDbContext db,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        db.WorkflowRunSteps.Add(new WorkflowRunStep
        {
            Id = Guid.NewGuid(),
            RunId = run.Id,
            NodeId = node.Id,
            NodeKind = node.Kind,
            CatalogKey = node.CatalogKey,
            Status = "completed",
            Attempt = await NextNodeAttempt(db, run.Id, node.Id, cancellationToken),
            StartedAt = now,
            CompletedAt = now,
            CreatedAt = now
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task<int> NextNodeAttempt(
        WorkflowsDbContext db,
        Guid runId,
        string nodeId,
        CancellationToken cancellationToken)
    {
        var previous = await db.WorkflowRunSteps
            .CountAsync(x => x.RunId == runId && x.NodeId == nodeId, cancellationToken);
        return previous + 1;
    }

    private static async Task FailRunAsync(
        WorkflowRun run,
        WorkflowsDbContext db,
        WorkflowLedgerWriter ledger,
        string errorCode,
        string? failedNodeId,
        string? errorDetail,
        CancellationToken cancellationToken)
    {
        run.Status = "failed";
        run.ActiveNodeIdsJson = "[]";
        run.FailedNodeId = failedNodeId;
        run.ErrorCode = errorCode;
        run.ErrorDetail = errorDetail;
        run.CompletedAt = DateTimeOffset.UtcNow;
        run.UpdatedAt = run.CompletedAt.Value;
        run.NextAttemptAt = null;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await AppendRunLifecycleAsync(
            run,
            ledger,
            "failed",
            new
            {
                run.WorkflowVersion,
                failedNodeId,
                errorCode
            },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task AppendRunLifecycleAsync(
        WorkflowRun run,
        WorkflowLedgerWriter ledger,
        string transition,
        object metadata,
        CancellationToken cancellationToken)
    {
        var runId = OpaqueId.Format("run", run.Id);
        var workflowId = OpaqueId.Format("wf", run.WorkflowId);
        var actorId = OpaqueId.Format("user", run.RequestedByUserId);

        await ledger.AppendAuditAsync(
            AuditActionPrefix(run.OwnerModule) + "." + transition,
            run.OwnerModule,
            "automation_run",
            runId,
            actorId,
            run.CorrelationId,
            run.TraceId,
            new
            {
                ownerModule = run.OwnerModule,
                workflowId,
                runId,
                metadata
            },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "automation.run." + transition,
            "workflows",
            "automation_run",
            runId,
            new
            {
                ownerModule = run.OwnerModule,
                workflowId,
                workflowVersion = run.WorkflowVersion,
                runId,
                status = run.Status
            },
            run.CorrelationId,
            null,
            run.TraceId,
            cancellationToken);
    }

    private static bool TrySnapshotGraph(
        string snapshotJson,
        out string nodesJson,
        out string edgesJson,
        out string error)
    {
        nodesJson = "[]";
        edgesJson = "[]";
        error = "";

        try
        {
            using var document = JsonDocument.Parse(snapshotJson);
            if (!document.RootElement.TryGetProperty("nodes", out var nodes)
                || nodes.ValueKind != JsonValueKind.Array
                || !document.RootElement.TryGetProperty("edges", out var edges)
                || edges.ValueKind != JsonValueKind.Array)
            {
                error = "The execution snapshot does not contain node and edge arrays.";
                return false;
            }

            nodesJson = nodes.GetRawText();
            edgesJson = edges.GetRawText();
            return true;
        }
        catch (JsonException)
        {
            error = "The execution snapshot is not valid JSON.";
            return false;
        }
    }

    private static int? WaitDurationSeconds(JsonElement configuration)
    {
        if (!configuration.TryGetProperty("durationSeconds", out var value))
        {
            return 0;
        }

        if (value.ValueKind != JsonValueKind.Number
            || !value.TryGetInt32(out var seconds)
            || seconds is < 0 or > 300)
        {
            return null;
        }

        return seconds;
    }

    private static List<string> DeserializeIds(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static string? ManagePermission(string ownerModule) =>
        ownerModule switch
        {
            "helpdesk" => "helpdesk.automation.manage",
            "assets" => "assets.automation.manage",
            _ => null
        };

    private static string AuditActionPrefix(string ownerModule) =>
        ownerModule switch
        {
            "helpdesk" => "helpdesk.automation.run",
            "assets" => "assets.automation.run",
            _ => "automation.run"
        };

    private static ClaimsPrincipal Principal(string subject) =>
        new(new ClaimsIdentity(
            new[] { new Claim("sub", subject) },
            "automation-worker"));

    private static int RetryDelaySeconds(int attempt) =>
        Math.Min(8, (int)Math.Pow(2, Math.Max(0, attempt - 1)));
}
