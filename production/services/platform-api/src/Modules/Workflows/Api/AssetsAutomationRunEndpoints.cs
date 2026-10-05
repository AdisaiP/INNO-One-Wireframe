using System.Security.Claims;
using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Assets;
using INNO.One.Contracts.Automation;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Workflows.Application;
using INNO.One.Modules.Workflows.Domain;
using INNO.One.Modules.Workflows.Infrastructure;
using INNO.One.Modules.Workflows.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Workflows.Api;

public static class AssetsAutomationRunEndpoints
{
    private const string OwnerModule = "assets";
    private const string ManagePermission = "assets.automation.manage";
    private const string RunViewPermission = "assets.automation.run.view";

    public static RouteGroupBuilder MapAssetsAutomationRunEndpoints(
        this RouteGroupBuilder api)
    {
        api.MapPost("/assets/automations/{automationId}/runs", StartRunAsync)
            .WithName("assets.automations.runs.start");
        api.MapGet("/assets/automations/{automationId}/runs", ListRunsAsync)
            .WithName("assets.automations.runs.list");
        api.MapGet("/assets/automations/{automationId}/runs/{runId}", GetRunAsync)
            .WithName("assets.automations.runs.get");
        return api;
    }

    private static async Task<IResult> StartRunAsync(
        string automationId,
        StartAutomationRunRequest request,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        IAssetsAutomationContextReader assetsReader,
        IEnumerable<IAutomationNodeExecutor> executors,
        WorkflowLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(automationId, "wf", out var workflowId))
        {
            return AutomationNotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            ManagePermission,
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var subject = httpContext.User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(subject))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Authentication subject missing");
        }

        if (request.Input.ValueKind != JsonValueKind.Object)
        {
            return Validation("input", "Run input must be an object.");
        }

        var definition = await db.WorkflowDefinitions.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == workflowId
                    && x.OwnerModule == OwnerModule
                    && x.Status != "deleted",
                cancellationToken);
        if (definition is null)
        {
            return AutomationNotFound();
        }

        var version = await db.WorkflowDefinitionVersions.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.WorkflowId == workflowId
                    && x.Version == definition.Version
                    && x.OwnerModule == OwnerModule,
                cancellationToken);
        if (version is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Automation version unavailable",
                detail: "The current immutable Assets automation version could not be loaded.");
        }

        var context = await ValidateRuleContextAsync(
            version.NodesJson,
            request.Input,
            httpContext.User,
            access.UserId,
            accessEvaluator,
            assetsReader,
            cancellationToken);
        if (!context.Valid)
        {
            return NotExecutable(
                context.ErrorCode ?? "ASSETS_CONTEXT_INVALID",
                context.ErrorDetail);
        }

        var actionPermission = await ValidateActionPermissionAsync(
            version.NodesJson,
            context.ResourceType,
            httpContext.User,
            access.UserId,
            accessEvaluator,
            cancellationToken);
        if (!actionPermission.Valid)
        {
            return NotExecutable(
                actionPermission.ErrorCode ?? "ASSETS_ACTION_INVALID",
                actionPermission.ErrorDetail);
        }

        var executorList = executors.ToList();
        if (!WorkflowExecutionPlanner.TryCreate(
                OwnerModule,
                version.NodesJson,
                version.EdgesJson,
                executorList,
                out _,
                out var planErrorCode,
                out var planErrorDetail))
        {
            return NotExecutable(
                planErrorCode ?? "AUTOMATION_NOT_EXECUTABLE",
                planErrorDetail);
        }

        var snapshot = SnapshotJson(automationId, version);
        var now = DateTimeOffset.UtcNow;
        var run = new WorkflowRun
        {
            Id = Guid.NewGuid(),
            WorkflowId = workflowId,
            WorkflowVersion = version.Version,
            OwnerModule = OwnerModule,
            WorkflowName = version.Name,
            DefinitionSnapshotJson = snapshot,
            InputJson = request.Input.GetRawText(),
            Status = "queued",
            ActiveNodeIdsJson = "[]",
            CompletedNodeIdsJson = "[]",
            AttemptCount = 1,
            MaxAttempts = 3,
            NextAttemptAt = now,
            RequestedByUserId = access.UserId,
            RequestedBySubject = subject,
            CorrelationId = CorrelationId(httpContext),
            TraceId = httpContext.TraceIdentifier,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        db.WorkflowRuns.Add(run);
        await db.SaveChangesAsync(cancellationToken);

        var publicRunId = OpaqueId.Format("run", run.Id);
        var actorId = OpaqueId.Format("user", access.UserId);

        await ledger.AppendAuditAsync(
            "assets.automation.run.queued",
            OwnerModule,
            "automation_run",
            publicRunId,
            actorId,
            run.CorrelationId,
            run.TraceId,
            new
            {
                ownerModule = OwnerModule,
                workflowId = automationId,
                workflowVersion = version.Version,
                runId = publicRunId,
                resourceType = context.ResourceType,
                resourceId = context.ResourceId
            },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "automation.run.queued",
            "workflows",
            "automation_run",
            publicRunId,
            new
            {
                ownerModule = OwnerModule,
                workflowId = automationId,
                workflowVersion = version.Version,
                runId = publicRunId,
                resourceType = context.ResourceType,
                resourceId = context.ResourceId
            },
            run.CorrelationId,
            null,
            run.TraceId,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return Results.Accepted(
            $"/api/v1/assets/automations/{automationId}/runs/{publicRunId}",
            new ResourceResponse<AssetsAutomationRunDetail>(
                ToDetail(run, [])));
    }

    private static async Task<IResult> ListRunsAsync(
        string automationId,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        int page = 1,
        int pageSize = 25,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        if (!OpaqueId.TryParse(automationId, "wf", out var workflowId))
        {
            return AutomationNotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            RunViewPermission,
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.WorkflowRuns.AsNoTracking()
            .Where(x => x.OwnerModule == OwnerModule && x.WorkflowId == workflowId);

        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == normalized);
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = rows.Select(ToSummary).ToList();
        var totalPages = totalItems == 0
            ? 0
            : (int)Math.Ceiling(totalItems / (double)pageSize);

        return Results.Ok(new PagedResponse<AssetsAutomationRunSummary>(
            items,
            page,
            pageSize,
            totalItems,
            totalPages));
    }

    private static async Task<IResult> GetRunAsync(
        string automationId,
        string runId,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(automationId, "wf", out var workflowId)
            || !OpaqueId.TryParse(runId, "run", out var parsedRunId))
        {
            return RunNotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            RunViewPermission,
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var run = await db.WorkflowRuns.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == parsedRunId
                    && x.WorkflowId == workflowId
                    && x.OwnerModule == OwnerModule,
                cancellationToken);
        if (run is null)
        {
            return RunNotFound();
        }

        var steps = await db.WorkflowRunSteps.AsNoTracking()
            .Where(x => x.RunId == run.Id)
            .OrderBy(x => x.CreatedAt)
            .ThenBy(x => x.Attempt)
            .ToListAsync(cancellationToken);

        return Results.Ok(new ResourceResponse<AssetsAutomationRunDetail>(
            ToDetail(run, steps)));
    }

    private static async Task<ContextValidation> ValidateRuleContextAsync(
        string nodesJson,
        JsonElement input,
        ClaimsPrincipal principal,
        Guid actorUserId,
        IAccessEvaluator accessEvaluator,
        IAssetsAutomationContextReader assetsReader,
        CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(nodesJson);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            return ContextValidation.Fail(
                "ASSETS_RULE_INVALID",
                "Assets automation nodes must be an array.");
        }

        var triggers = document.RootElement.EnumerateArray()
            .Where(x => TryString(x, "kind", out var kind) && kind == "trigger")
            .ToList();
        if (triggers.Count != 1
            || !TryString(triggers[0], "catalogKey", out var catalogKey))
        {
            return ContextValidation.Fail(
                "ASSETS_TRIGGER_REQUIRED",
                "Assets automation requires exactly one supported trigger.");
        }

        var configuration = triggers[0].TryGetProperty("configuration", out var config)
            && config.ValueKind == JsonValueKind.Object
            ? config
            : EmptyObject();

        if (catalogKey.StartsWith("assets.asset.", StringComparison.Ordinal))
        {
            if (!TryInputId(input, "assetId", "asset", out var publicAssetId, out var assetId))
            {
                return ContextValidation.Fail(
                    "ASSETS_ASSET_CONTEXT_REQUIRED",
                    "Select a valid Asset for this run.");
            }

            var assetAccess = await accessEvaluator.EvaluateAsync(
                principal,
                "assets.view",
                cancellationToken);
            if (!assetAccess.Allowed || assetAccess.UserId != actorUserId)
            {
                return ContextValidation.Fail(
                    "ASSETS_VIEW_PERMISSION_DENIED",
                    "The automation actor does not currently have Asset view permission.");
            }

            if (!await assetsReader.CanAccessAssetAsync(
                    assetId,
                    assetAccess,
                    cancellationToken))
            {
                return ContextValidation.Fail(
                    "ASSETS_OUTSIDE_ASSIGNED_SCOPE",
                    "The Asset is outside the automation actor's current scope.");
            }

            var asset = await assetsReader.ReadAssetAsync(
                assetId,
                cancellationToken);
            if (asset is null)
            {
                return ContextValidation.Fail(
                    "ASSETS_ASSET_NOT_FOUND",
                    "The Asset is unavailable.");
            }

            var triggerValidation = await ValidateAssetTriggerAsync(
                catalogKey,
                configuration,
                asset,
                assetsReader,
                cancellationToken);
            if (!triggerValidation.Valid)
            {
                return triggerValidation;
            }

            var condition = ValidateAssetCondition(configuration, asset);
            return condition.Valid
                ? ContextValidation.Ok("asset", publicAssetId)
                : condition;
        }

        if (catalogKey == "assets.license.overused")
        {
            if (!TryInputId(input, "licenseId", "license", out var publicLicenseId, out var licenseId))
            {
                return ContextValidation.Fail(
                    "ASSETS_LICENSE_CONTEXT_REQUIRED",
                    "Select a valid Software License for this run.");
            }

            var licenseAccess = await accessEvaluator.EvaluateAsync(
                principal,
                "assets.license.manage",
                cancellationToken);
            if (!licenseAccess.Allowed || licenseAccess.UserId != actorUserId)
            {
                return ContextValidation.Fail(
                    "ASSETS_LICENSE_PERMISSION_DENIED",
                    "The automation actor does not currently have software license management permission.");
            }

            var license = await assetsReader.ReadLicenseAsync(
                licenseId,
                cancellationToken);
            if (license is null)
            {
                return ContextValidation.Fail(
                    "ASSETS_LICENSE_NOT_FOUND",
                    "The Software License is unavailable.");
            }

            if (license.UsedSeats <= license.EntitledSeats)
            {
                return ContextValidation.Fail(
                    "ASSETS_LICENSE_THRESHOLD_NOT_REACHED",
                    "The selected Software License is not currently overused.");
            }

            var condition = ValidateLicenseCondition(configuration, license);
            return condition.Valid
                ? ContextValidation.Ok("license", publicLicenseId)
                : condition;
        }

        return ContextValidation.Fail(
            "ASSETS_TRIGGER_NOT_SUPPORTED",
            "This Assets automation trigger is not executable.");
    }

    private static async Task<ContextValidation> ValidateActionPermissionAsync(
        string nodesJson,
        string? resourceType,
        ClaimsPrincipal principal,
        Guid actorUserId,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(nodesJson);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            return ContextValidation.Fail(
                "ASSETS_RULE_INVALID",
                "Assets automation nodes must be an array.");
        }

        var actions = document.RootElement.EnumerateArray()
            .Where(x => TryString(x, "kind", out var kind) && kind == "action")
            .ToList();
        if (actions.Count != 1
            || !TryString(actions[0], "catalogKey", out var catalogKey))
        {
            return ContextValidation.Fail(
                "ASSETS_ACTION_REQUIRED",
                "Assets automation requires exactly one supported action.");
        }

        string permission;
        string errorCode;
        string errorDetail;

        if (catalogKey == "assets.asset.set_lifecycle_status")
        {
            if (!string.Equals(resourceType, "asset", StringComparison.Ordinal))
            {
                return ContextValidation.Fail(
                    "ASSETS_ACTION_CONTEXT_MISMATCH",
                    "Update Lifecycle can run only with an Asset context.");
            }

            permission = "assets.manage";
            errorCode = "ASSETS_MANAGE_PERMISSION_DENIED";
            errorDetail = "The automation actor does not currently have Assets management permission.";
        }
        else if (catalogKey == "helpdesk.ticket.create")
        {
            if (resourceType is not ("asset" or "license"))
            {
                return ContextValidation.Fail(
                    "ASSETS_ACTION_CONTEXT_MISMATCH",
                    "Create Helpdesk Ticket requires an Asset or Software License context.");
            }

            permission = "helpdesk.ticket.create";
            errorCode = "HELPDESK_CREATE_PERMISSION_DENIED";
            errorDetail = "The automation actor does not currently have Helpdesk ticket creation permission.";
        }
        else
        {
            return ContextValidation.Fail(
                "ASSETS_ACTION_NOT_SUPPORTED",
                "This Assets automation action is not executable.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            principal,
            permission,
            cancellationToken);
        return access.Allowed && access.UserId == actorUserId
            ? ContextValidation.Ok()
            : ContextValidation.Fail(errorCode, errorDetail);
    }

    private static async Task<ContextValidation> ValidateAssetTriggerAsync(
        string catalogKey,
        JsonElement configuration,
        AssetAutomationAssetContext asset,
        IAssetsAutomationContextReader assetsReader,
        CancellationToken cancellationToken)
    {
        if (catalogKey == "assets.asset.lifecycle_status")
        {
            if (!TryString(configuration, "status", out var status))
            {
                return ContextValidation.Fail(
                    "ASSETS_LIFECYCLE_TRIGGER_STATUS_REQUIRED",
                    "Lifecycle trigger requires a status.");
            }

            return string.Equals(
                    asset.LifecycleStatus,
                    status,
                    StringComparison.OrdinalIgnoreCase)
                ? ContextValidation.Ok()
                : ContextValidation.Fail(
                    "ASSETS_LIFECYCLE_CONTEXT_MISMATCH",
                    $"The selected Asset is currently {asset.LifecycleStatus}; this rule requires {status}.");
        }

        if (catalogKey == "assets.asset.owner_unassigned")
        {
            return !asset.OwnerUserId.HasValue
                ? ContextValidation.Ok()
                : ContextValidation.Fail(
                    "ASSETS_OWNER_CONTEXT_MISMATCH",
                    "The selected Asset already has an owner.");
        }

        if (catalogKey == "assets.asset.warranty_expiring")
        {
            if (!TryInt(configuration, "withinDays", out var withinDays)
                || withinDays is < 0 or > 3650)
            {
                return ContextValidation.Fail(
                    "ASSETS_WARRANTY_THRESHOLD_INVALID",
                    "Warranty threshold must be between 0 and 3650 days.");
            }

            if (!asset.WarrantyEndAt.HasValue)
            {
                return ContextValidation.Fail(
                    "ASSETS_WARRANTY_MISSING",
                    "The selected Asset does not have a warranty end date.");
            }

            var remaining = (asset.WarrantyEndAt.Value - DateTimeOffset.UtcNow).TotalDays;
            return remaining >= 0 && remaining <= withinDays
                ? ContextValidation.Ok()
                : ContextValidation.Fail(
                    "ASSETS_WARRANTY_THRESHOLD_NOT_REACHED",
                    "The selected Asset is not currently inside the configured warranty expiry threshold.");
        }

        if (catalogKey == "assets.asset.baseline_drift")
        {
            if (!TryString(configuration, "baselineId", out var baselinePublicId)
                || !OpaqueId.TryParse(baselinePublicId, "baseline", out var baselineId))
            {
                return ContextValidation.Fail(
                    "ASSETS_BASELINE_REQUIRED",
                    "Baseline Drift requires a Software Baseline.");
            }

            var result = await assetsReader.ReadLatestBaselineResultAsync(
                asset.Id,
                baselineId,
                cancellationToken);
            if (result is null)
            {
                return ContextValidation.Fail(
                    "ASSETS_BASELINE_RESULT_MISSING",
                    "No persisted baseline result exists for the selected Asset.");
            }

            return result.ResultStatus == "missing"
                ? ContextValidation.Ok()
                : ContextValidation.Fail(
                    "ASSETS_BASELINE_DRIFT_NOT_PRESENT",
                    $"The latest baseline result is {result.ResultStatus}, not missing.");
        }

        return ContextValidation.Fail(
            "ASSETS_TRIGGER_NOT_SUPPORTED",
            "This Asset trigger is not executable.");
    }

    private static ContextValidation ValidateAssetCondition(
        JsonElement configuration,
        AssetAutomationAssetContext asset)
    {
        if (!TryCondition(configuration, out var field, out var op, out var value))
        {
            return ContextValidation.Ok();
        }

        var actual = field switch
        {
            "category" => asset.Category,
            "lifecycleStatus" => asset.LifecycleStatus,
            "ownerState" => asset.OwnerUserId.HasValue ? "assigned" : "unassigned",
            _ => null
        };

        if (actual is null)
        {
            return ContextValidation.Fail(
                "ASSETS_CONDITION_INVALID",
                "The optional Asset IF condition is invalid.");
        }

        return Match(actual, op, value)
            ? ContextValidation.Ok()
            : ContextValidation.Fail(
                "ASSETS_RULE_CONDITION_NOT_MATCHED",
                "The selected Asset does not match the current IF condition.");
    }

    private static ContextValidation ValidateLicenseCondition(
        JsonElement configuration,
        AssetAutomationLicenseContext license)
    {
        if (!TryCondition(configuration, out var field, out var op, out var value))
        {
            return ContextValidation.Ok();
        }

        var actual = field switch
        {
            "vendor" => license.Vendor,
            "licenseModel" => license.LicenseModel,
            "compliance" => license.UsedSeats > license.EntitledSeats
                ? "overused"
                : "compliant",
            _ => null
        };

        if (actual is null)
        {
            return ContextValidation.Fail(
                "ASSETS_CONDITION_INVALID",
                "The optional Software License IF condition is invalid.");
        }

        return Match(actual, op, value)
            ? ContextValidation.Ok()
            : ContextValidation.Fail(
                "ASSETS_RULE_CONDITION_NOT_MATCHED",
                "The selected Software License does not match the current IF condition.");
    }

    private static bool TryCondition(
        JsonElement configuration,
        out string field,
        out string op,
        out string value)
    {
        field = op = value = "";
        if (!configuration.TryGetProperty("condition", out var condition)
            || condition.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        return TryString(condition, "field", out field)
            && TryString(condition, "operator", out op)
            && TryString(condition, "value", out value);
    }

    private static bool Match(string actual, string op, string expected) =>
        op switch
        {
            "equals" => string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase),
            "not_equals" => !string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase),
            "contains" => actual.Contains(expected, StringComparison.OrdinalIgnoreCase),
            _ => false
        };

    private static AssetsAutomationRunSummary ToSummary(WorkflowRun run)
    {
        var (resourceType, resourceId) = Resource(run.InputJson);
        return new(
            OpaqueId.Format("run", run.Id),
            OpaqueId.Format("wf", run.WorkflowId),
            run.WorkflowVersion,
            run.WorkflowName,
            run.Status,
            resourceType,
            resourceId,
            run.AttemptCount,
            run.MaxAttempts,
            run.ErrorCode,
            run.CreatedAt,
            run.StartedAt,
            run.CompletedAt);
    }

    private static AssetsAutomationRunDetail ToDetail(
        WorkflowRun run,
        IReadOnlyCollection<WorkflowRunStep> steps)
    {
        using var snapshot = JsonDocument.Parse(run.DefinitionSnapshotJson);
        using var input = JsonDocument.Parse(run.InputJson);
        using var active = JsonDocument.Parse(run.ActiveNodeIdsJson);
        using var completed = JsonDocument.Parse(run.CompletedNodeIdsJson);
        var (resourceType, resourceId) = Resource(run.InputJson);

        return new AssetsAutomationRunDetail(
            OpaqueId.Format("run", run.Id),
            OpaqueId.Format("wf", run.WorkflowId),
            run.WorkflowVersion,
            run.OwnerModule,
            run.WorkflowName,
            run.Status,
            resourceType,
            resourceId,
            input.RootElement.Clone(),
            snapshot.RootElement.Clone(),
            active.RootElement.Clone(),
            completed.RootElement.Clone(),
            run.FailedNodeId,
            run.AttemptCount,
            run.MaxAttempts,
            run.ErrorCode,
            run.ErrorDetail,
            run.CreatedAt,
            run.StartedAt,
            run.CompletedAt,
            steps.Select(x => new AutomationRunStepDetail(
                OpaqueId.Format("step", x.Id),
                x.NodeId,
                x.NodeKind,
                x.CatalogKey,
                x.Status,
                x.Attempt,
                ParseOptionalJson(x.OutputJson),
                x.ErrorCode,
                x.ErrorDetail,
                x.StartedAt,
                x.CompletedAt)).ToList());
    }

    private static string SnapshotJson(
        string automationId,
        WorkflowDefinitionVersion version)
    {
        using var nodes = JsonDocument.Parse(version.NodesJson);
        using var edges = JsonDocument.Parse(version.EdgesJson);

        return JsonSerializer.Serialize(new
        {
            schemaVersion = 1,
            workflowId = automationId,
            workflowVersion = version.Version,
            ownerModule = version.OwnerModule,
            name = version.Name,
            nodes = nodes.RootElement.Clone(),
            edges = edges.RootElement.Clone(),
            orientation = version.Orientation,
            status = version.Status
        });
    }

    private static JsonElement? ParseOptionalJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    private static (string? ResourceType, string? ResourceId) Resource(
        string inputJson)
    {
        try
        {
            using var input = JsonDocument.Parse(inputJson);
            if (TryString(input.RootElement, "assetId", out var assetId))
            {
                return ("asset", assetId);
            }

            if (TryString(input.RootElement, "licenseId", out var licenseId))
            {
                return ("license", licenseId);
            }
        }
        catch (JsonException)
        {
        }

        return (null, null);
    }

    private static bool TryInputId(
        JsonElement input,
        string property,
        string prefix,
        out string publicId,
        out Guid id)
    {
        publicId = "";
        id = Guid.Empty;
        return TryString(input, property, out publicId)
            && OpaqueId.TryParse(publicId, prefix, out id);
    }

    private static bool TryString(
        JsonElement element,
        string property,
        out string value)
    {
        value = "";
        if (element.ValueKind != JsonValueKind.Object
            || !element.TryGetProperty(property, out var candidate)
            || candidate.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = candidate.GetString()?.Trim() ?? "";
        return value.Length > 0;
    }

    private static bool TryInt(
        JsonElement element,
        string property,
        out int value)
    {
        value = 0;
        return element.TryGetProperty(property, out var candidate)
            && candidate.ValueKind == JsonValueKind.Number
            && candidate.TryGetInt32(out value);
    }

    private static JsonElement EmptyObject() =>
        JsonSerializer.SerializeToElement(new { });

    private static IResult NotExecutable(string code, string? detail) =>
        Results.UnprocessableEntity(new
        {
            type = "https://inno.one/problems/automation-not-executable",
            title = "Automation is not executable",
            status = 422,
            code,
            detail = detail ?? "The current Assets automation cannot be executed."
        });

    private static IResult Validation(string field, string message) =>
        Results.UnprocessableEntity(new
        {
            type = "https://inno.one/problems/validation",
            title = "Validation failed",
            status = 422,
            code = "VALIDATION_FAILED",
            detail = "One or more fields are invalid.",
            fieldErrors = new Dictionary<string, string[]>
            {
                [field] = [message]
            }
        });

    private static IResult Forbidden(string? reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Permission denied",
        detail: reason ?? "You do not have permission to access Assets automation.");

    private static IResult AutomationNotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Assets automation not found",
        detail: "The automation does not exist in Assets or is unavailable.");

    private static IResult RunNotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Automation run not found",
        detail: "The run does not exist for this Assets automation.");

    private static string CorrelationId(HttpContext httpContext) =>
        string.IsNullOrWhiteSpace(httpContext.Request.Headers["X-Correlation-Id"])
            ? httpContext.TraceIdentifier
            : httpContext.Request.Headers["X-Correlation-Id"].ToString();

    private sealed record ContextValidation(
        bool Valid,
        string? ResourceType,
        string? ResourceId,
        string? ErrorCode,
        string? ErrorDetail)
    {
        public static ContextValidation Ok(
            string? resourceType = null,
            string? resourceId = null) =>
            new(true, resourceType, resourceId, null, null);

        public static ContextValidation Fail(
            string code,
            string detail) =>
            new(false, null, null, code, detail);
    }
}

public sealed record AssetsAutomationRunSummary(
    string Id,
    string WorkflowId,
    long WorkflowVersion,
    string WorkflowName,
    string Status,
    string? ResourceType,
    string? ResourceId,
    int AttemptCount,
    int MaxAttempts,
    string? ErrorCode,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt);

public sealed record AssetsAutomationRunDetail(
    string Id,
    string WorkflowId,
    long WorkflowVersion,
    string OwnerModule,
    string WorkflowName,
    string Status,
    string? ResourceType,
    string? ResourceId,
    JsonElement Input,
    JsonElement DefinitionSnapshot,
    JsonElement ActiveNodeIds,
    JsonElement CompletedNodeIds,
    string? FailedNodeId,
    int AttemptCount,
    int MaxAttempts,
    string? ErrorCode,
    string? ErrorDetail,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    IReadOnlyList<AutomationRunStepDetail> Steps);
