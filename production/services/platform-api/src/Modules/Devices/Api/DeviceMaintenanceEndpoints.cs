using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Api;

public static class DeviceMaintenanceEndpoints
{
    public static RouteGroupBuilder MapDeviceMaintenanceEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices/deployments", ListDeploymentsAsync)
            .WithName("devices.deployments.list");
        api.MapPost("/devices/deployments", CreateDeploymentAsync)
            .WithName("devices.deployments.create");
        api.MapGet("/devices/deployments/{deploymentId}", GetDeploymentAsync)
            .WithName("devices.deployments.get");

        api.MapGet("/devices/agent-rollouts", ListAgentRolloutsAsync)
            .WithName("devices.agent_rollouts.list");
        api.MapPost("/devices/agent-rollouts", CreateAgentRolloutAsync)
            .WithName("devices.agent_rollouts.create");

        api.MapGet("/devices/software-maintenance-jobs", ListSoftwareJobsAsync)
            .WithName("devices.software_jobs.list");
        api.MapPost("/devices/software-maintenance-jobs", CreateSoftwareJobAsync)
            .WithName("devices.software_jobs.create");

        api.MapGet("/devices/restart-jobs", ListRestartJobsAsync)
            .WithName("devices.restart_jobs.list");
        api.MapPost("/devices/restart-jobs", CreateRestartJobAsync)
            .WithName("devices.restart_jobs.create");

        api.MapGet("/devices/maintenance-history", ListMaintenanceHistoryAsync)
            .WithName("devices.maintenance_history.list");
        return api;
    }

    private static async Task<IResult> ListDeploymentsAsync(
        int page,
        int pageSize,
        string? search,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await EvaluateAsync(httpContext, accessEvaluator, "devices.view", cancellationToken);
        if (access.Result is not null) return access.Result;

        var effectiveGroupIds = await EffectiveGroupIdsAsync(db, access.Access!, cancellationToken);
        var query = ApplyJobScope(db.DeploymentJobs.AsNoTracking(), access.Access!, effectiveGroupIds);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.JobNumber.ToLower().Contains(term)
                || x.PayloadName.ToLower().Contains(term)
                || x.TargetLabel.ToLower().Contains(term)
                || x.DeploymentType.ToLower().Contains(term));
        }

        return await PageDeploymentsAsync(query, page, pageSize, cancellationToken);
    }

    private static async Task<IResult> CreateDeploymentAsync(
        CreateDeploymentRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await EvaluateAsync(httpContext, accessEvaluator, "devices.deploy", cancellationToken);
        if (access.Result is not null) return access.Result;

        var deploymentType = NormalizeOne(request.DeploymentType, "agent", "software", "files");
        if (deploymentType is null)
            return Validation("deploymentType", "Deployment type must be agent, software or files.");
        if (string.IsNullOrWhiteSpace(request.PayloadName))
            return Validation("payloadName", "Payload is required.");

        var target = await ResolveTargetAsync(
            request.TargetScopeType,
            request.TargetScopeId,
            request.SelectedDeviceIds,
            request.TargetLabel,
            access.Access!,
            db,
            cancellationToken);
        if (target.Result is not null) return target.Result;

        var schedule = NormalizeSchedule(request.ScheduleMode, request.ScheduledAt);
        if (schedule.Result is not null) return schedule.Result;

        var now = DateTimeOffset.UtcNow;
        var jobId = Guid.NewGuid();
        var operationId = Guid.NewGuid();
        var job = new DeploymentJob
        {
            Id = jobId,
            OperationId = operationId,
            CreatedByUserId = access.Access!.UserId,
            JobNumber = JobNumber("DEP", now, jobId),
            DeploymentType = deploymentType,
            TargetScopeType = target.ScopeType!,
            TargetScopeId = target.ScopeId,
            TargetDefinitionJson = target.DefinitionJson!,
            TargetLabel = target.Label!,
            PayloadName = request.PayloadName.Trim(),
            ProfileOrDestination = TrimToNull(request.ProfileOrDestination),
            ScheduleMode = schedule.Mode!,
            ScheduledAt = schedule.ScheduledAt,
            MaintenanceWindow = TrimToNull(request.MaintenanceWindow),
            RetryAttempts = Math.Clamp(request.RetryAttempts ?? 3, 0, 10),
            RestartPolicy = TrimToNull(request.RestartPolicy),
            Status = schedule.Mode == "scheduled" ? "scheduled" : "queued",
            TargetCount = target.TargetCount,
            CreatedAt = now
        };

        db.DeploymentJobs.Add(job);
        await db.SaveChangesAsync(cancellationToken);

        var resultUrl = $"/api/v1/devices/deployments/{OpaqueId.Format("dep", jobId)}";
        await CompleteCreationOperationAsync(
            ledger, operationId, "devices.deployment.create", "deployment", jobId,
            access.Access.UserId, resultUrl, cancellationToken);

        await ledger.AppendAuditAsync(
            "devices.deployment.created",
            "deployment",
            OpaqueId.Format("dep", jobId),
            OpaqueId.Format("user", access.Access.UserId),
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                jobNumber = job.JobNumber,
                deploymentType,
                targetScopeType = job.TargetScopeType,
                targetCount = job.TargetCount,
                job.Status
            },
            cancellationToken,
            "internal");

        return Results.Accepted(resultUrl, Accepted(operationId, resultUrl, OpaqueId.Format("dep", jobId)));
    }

    private static async Task<IResult> GetDeploymentAsync(
        string deploymentId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deploymentId, "dep", out var id))
            return Problem(404, "Deployment not found", "DEPLOYMENT_NOT_FOUND");

        var access = await EvaluateAsync(httpContext, accessEvaluator, "devices.view", cancellationToken);
        if (access.Result is not null) return access.Result;

        var effectiveGroupIds = await EffectiveGroupIdsAsync(db, access.Access!, cancellationToken);
        var item = await ApplyJobScope(db.DeploymentJobs.AsNoTracking(), access.Access!, effectiveGroupIds)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
            return Problem(404, "Deployment not found", "DEPLOYMENT_NOT_FOUND");

        return Results.Ok(new ResourceResponse<DeploymentJobResponse>(ToResponse(item)));
    }

    private static async Task<IResult> ListAgentRolloutsAsync(
        int page,
        int pageSize,
        string? search,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await EvaluateAsync(httpContext, accessEvaluator, "devices.view", cancellationToken);
        if (access.Result is not null) return access.Result;

        var effectiveGroupIds = await EffectiveGroupIdsAsync(db, access.Access!, cancellationToken);
        var query = ApplyJobScope(db.AgentRollouts.AsNoTracking(), access.Access!, effectiveGroupIds);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.RolloutNumber.ToLower().Contains(term)
                || x.ReleaseVersion.ToLower().Contains(term)
                || x.TargetLabel.ToLower().Contains(term));
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize <= 0 ? 25 : pageSize, 1, 100);
        var totalItems = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new AgentRolloutResponse(
                OpaqueId.Format("roll", x.Id),
                x.RolloutNumber,
                x.ReleaseVersion,
                x.TargetLabel,
                x.MaintenanceWindow,
                x.RetryAttempts,
                x.PauseFailureThresholdPercent,
                x.Status,
                x.TargetCount,
                x.CompletedCount,
                x.FailedCount,
                x.CreatedAt,
                x.StartedAt,
                x.CompletedAt))
            .ToListAsync(cancellationToken);

        return Paged(items, page, pageSize, totalItems);
    }

    private static async Task<IResult> CreateAgentRolloutAsync(
        CreateAgentRolloutRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await EvaluateAsync(httpContext, accessEvaluator, "devices.deploy", cancellationToken);
        if (access.Result is not null) return access.Result;
        if (string.IsNullOrWhiteSpace(request.ReleaseVersion))
            return Validation("releaseVersion", "Release version is required.");

        var target = await ResolveTargetAsync(
            request.TargetScopeType,
            request.TargetScopeId,
            request.SelectedDeviceIds,
            request.TargetLabel,
            access.Access!,
            db,
            cancellationToken);
        if (target.Result is not null) return target.Result;

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();
        var operationId = Guid.NewGuid();
        var rollout = new AgentRollout
        {
            Id = id,
            OperationId = operationId,
            CreatedByUserId = access.Access!.UserId,
            RolloutNumber = JobNumber("ROLL", now, id),
            ReleaseVersion = request.ReleaseVersion.Trim(),
            TargetScopeType = target.ScopeType!,
            TargetScopeId = target.ScopeId,
            TargetDefinitionJson = target.DefinitionJson!,
            TargetLabel = target.Label!,
            MaintenanceWindow = TrimToNull(request.MaintenanceWindow),
            RetryAttempts = Math.Clamp(request.RetryAttempts ?? 3, 0, 10),
            PauseFailureThresholdPercent = Math.Clamp(request.PauseFailureThresholdPercent ?? 10, 1, 100),
            Status = "queued",
            TargetCount = target.TargetCount,
            CreatedAt = now
        };
        db.AgentRollouts.Add(rollout);
        await db.SaveChangesAsync(cancellationToken);

        var resultUrl = "/api/v1/devices/agent-rollouts";
        await CompleteCreationOperationAsync(
            ledger, operationId, "devices.agent_rollout.create", "agent_rollout", id,
            access.Access.UserId, resultUrl, cancellationToken);
        await ledger.AppendAuditAsync(
            "devices.agent_rollout.created",
            "agent_rollout",
            OpaqueId.Format("roll", id),
            OpaqueId.Format("user", access.Access.UserId),
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                rollout.RolloutNumber,
                rollout.ReleaseVersion,
                rollout.TargetScopeType,
                rollout.TargetCount,
                rollout.Status
            },
            cancellationToken,
            "internal");

        return Results.Accepted(resultUrl, Accepted(operationId, resultUrl, OpaqueId.Format("roll", id)));
    }

    private static async Task<IResult> ListSoftwareJobsAsync(
        int page,
        int pageSize,
        string? search,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await EvaluateAsync(httpContext, accessEvaluator, "devices.view", cancellationToken);
        if (access.Result is not null) return access.Result;

        var effectiveGroupIds = await EffectiveGroupIdsAsync(db, access.Access!, cancellationToken);
        var query = ApplyJobScope(
            db.MaintenanceJobs.AsNoTracking().Where(x => x.MaintenanceType == "software"),
            access.Access!,
            effectiveGroupIds);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.JobNumber.ToLower().Contains(term)
                || (x.PackageName != null && x.PackageName.ToLower().Contains(term))
                || x.TargetLabel.ToLower().Contains(term));
        }
        return await PageMaintenanceAsync(query, page, pageSize, cancellationToken);
    }

    private static async Task<IResult> CreateSoftwareJobAsync(
        CreateSoftwareMaintenanceRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await EvaluateAsync(httpContext, accessEvaluator, "devices.deploy", cancellationToken);
        if (access.Result is not null) return access.Result;

        var action = NormalizeOne(request.Action, "install", "update", "uninstall");
        if (action is null)
            return Validation("action", "Action must be install, update or uninstall.");
        if (string.IsNullOrWhiteSpace(request.PackageName))
            return Validation("packageName", "Package is required.");

        var target = await ResolveTargetAsync(
            request.TargetScopeType,
            request.TargetScopeId,
            request.SelectedDeviceIds,
            request.TargetLabel,
            access.Access!,
            db,
            cancellationToken);
        if (target.Result is not null) return target.Result;

        var schedule = NormalizeSchedule(request.ScheduleMode, request.ScheduledAt);
        if (schedule.Result is not null) return schedule.Result;

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();
        var operationId = Guid.NewGuid();
        var job = new MaintenanceJob
        {
            Id = id,
            OperationId = operationId,
            CreatedByUserId = access.Access!.UserId,
            JobNumber = JobNumber("SW", now, id),
            MaintenanceType = "software",
            Action = action,
            PackageName = request.PackageName.Trim(),
            TargetScopeType = target.ScopeType!,
            TargetScopeId = target.ScopeId,
            TargetDefinitionJson = target.DefinitionJson!,
            TargetLabel = target.Label!,
            ScheduleMode = schedule.Mode!,
            ScheduledAt = schedule.ScheduledAt,
            MaintenanceWindow = TrimToNull(request.MaintenanceWindow),
            RetryAttempts = Math.Clamp(request.RetryAttempts ?? 3, 0, 10),
            RestartPolicy = TrimToNull(request.RestartPolicy),
            Status = schedule.Mode == "scheduled" ? "scheduled" : "queued",
            TargetCount = target.TargetCount,
            CreatedAt = now
        };
        db.MaintenanceJobs.Add(job);
        await db.SaveChangesAsync(cancellationToken);

        var resultUrl = "/api/v1/devices/software-maintenance-jobs";
        await CompleteCreationOperationAsync(
            ledger, operationId, "devices.software_maintenance.create", "maintenance_job", id,
            access.Access.UserId, resultUrl, cancellationToken);
        await ledger.AppendAuditAsync(
            "devices.software_maintenance.created",
            "maintenance_job",
            OpaqueId.Format("mnt", id),
            OpaqueId.Format("user", access.Access.UserId),
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                job.JobNumber,
                job.Action,
                job.PackageName,
                job.TargetScopeType,
                job.TargetCount,
                job.Status
            },
            cancellationToken,
            "internal");

        return Results.Accepted(resultUrl, Accepted(operationId, resultUrl, OpaqueId.Format("mnt", id)));
    }

    private static async Task<IResult> ListRestartJobsAsync(
        int page,
        int pageSize,
        string? search,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await EvaluateAsync(httpContext, accessEvaluator, "devices.view", cancellationToken);
        if (access.Result is not null) return access.Result;

        var effectiveGroupIds = await EffectiveGroupIdsAsync(db, access.Access!, cancellationToken);
        var query = ApplyJobScope(
            db.MaintenanceJobs.AsNoTracking().Where(x => x.MaintenanceType == "restart"),
            access.Access!,
            effectiveGroupIds);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.JobNumber.ToLower().Contains(term)
                || x.TargetLabel.ToLower().Contains(term));
        }
        return await PageMaintenanceAsync(query, page, pageSize, cancellationToken);
    }

    private static async Task<IResult> CreateRestartJobAsync(
        CreateRestartJobRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await EvaluateAsync(httpContext, accessEvaluator, "devices.manage", cancellationToken);
        if (access.Result is not null) return access.Result;

        var target = await ResolveTargetAsync(
            request.TargetScopeType,
            request.TargetScopeId,
            request.SelectedDeviceIds,
            request.TargetLabel,
            access.Access!,
            db,
            cancellationToken);
        if (target.Result is not null) return target.Result;

        if (request.ScheduledAt is null)
            return Validation("scheduledAt", "Restart time is required.");
        if (request.ScheduledAt <= DateTimeOffset.UtcNow)
            return Validation("scheduledAt", "Restart time must be in the future.");

        var offlinePolicy = NormalizeOne(request.OfflinePolicy, "next_check_in_24h", "skip") ?? "next_check_in_24h";
        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();
        var operationId = Guid.NewGuid();
        var job = new MaintenanceJob
        {
            Id = id,
            OperationId = operationId,
            CreatedByUserId = access.Access!.UserId,
            JobNumber = JobNumber("RST", now, id),
            MaintenanceType = "restart",
            Action = "restart",
            TargetScopeType = target.ScopeType!,
            TargetScopeId = target.ScopeId,
            TargetDefinitionJson = target.DefinitionJson!,
            TargetLabel = target.Label!,
            ScheduleMode = "scheduled",
            ScheduledAt = request.ScheduledAt,
            GraceMinutes = Math.Clamp(request.GraceMinutes ?? 10, 0, 120),
            UserMessage = TrimToNull(request.UserMessage),
            OfflinePolicy = offlinePolicy,
            Status = "scheduled",
            TargetCount = target.TargetCount,
            CreatedAt = now
        };
        db.MaintenanceJobs.Add(job);
        await db.SaveChangesAsync(cancellationToken);

        var resultUrl = "/api/v1/devices/restart-jobs";
        await CompleteCreationOperationAsync(
            ledger, operationId, "devices.restart_job.create", "maintenance_job", id,
            access.Access.UserId, resultUrl, cancellationToken);
        await ledger.AppendAuditAsync(
            "devices.restart_job.created",
            "maintenance_job",
            OpaqueId.Format("mnt", id),
            OpaqueId.Format("user", access.Access.UserId),
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                job.JobNumber,
                job.TargetScopeType,
                job.TargetCount,
                job.ScheduledAt,
                job.GraceMinutes,
                job.OfflinePolicy,
                job.Status
            },
            cancellationToken,
            "restricted");

        return Results.Accepted(resultUrl, Accepted(operationId, resultUrl, OpaqueId.Format("mnt", id)));
    }

    private static async Task<IResult> ListMaintenanceHistoryAsync(
        int page,
        int pageSize,
        string? search,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await EvaluateAsync(httpContext, accessEvaluator, "devices.view", cancellationToken);
        if (access.Result is not null) return access.Result;

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize <= 0 ? 25 : pageSize, 1, 100);

        var effectiveGroupIds = await EffectiveGroupIdsAsync(db, access.Access!, cancellationToken);

        var rollouts = await ApplyJobScope(db.AgentRollouts.AsNoTracking(), access.Access!, effectiveGroupIds)
            .OrderByDescending(x => x.CreatedAt)
            .Take(500)
            .Select(x => new MaintenanceHistoryItem(
                OpaqueId.Format("roll", x.Id),
                x.RolloutNumber,
                "agent",
                x.ReleaseVersion,
                x.TargetLabel,
                x.CompletedCount,
                x.FailedCount,
                x.Status,
                x.CreatedAt,
                x.CompletedAt))
            .ToListAsync(cancellationToken);

        var maintenance = await ApplyJobScope(db.MaintenanceJobs.AsNoTracking(), access.Access!, effectiveGroupIds)
            .OrderByDescending(x => x.CreatedAt)
            .Take(500)
            .Select(x => new MaintenanceHistoryItem(
                OpaqueId.Format("mnt", x.Id),
                x.JobNumber,
                x.MaintenanceType,
                x.PackageName ?? x.Action ?? x.MaintenanceType,
                x.TargetLabel,
                x.CompletedCount,
                x.FailedCount,
                x.Status,
                x.CreatedAt,
                x.CompletedAt))
            .ToListAsync(cancellationToken);

        IEnumerable<MaintenanceHistoryItem> combined = rollouts.Concat(maintenance);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            combined = combined.Where(x =>
                x.JobNumber.Contains(term, StringComparison.OrdinalIgnoreCase)
                || x.Summary.Contains(term, StringComparison.OrdinalIgnoreCase)
                || x.TargetLabel.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        var ordered = combined.OrderByDescending(x => x.CreatedAt).ToList();
        var totalItems = ordered.Count;
        var items = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToArray();
        return Paged(items, page, pageSize, totalItems);
    }

    private static async Task<IResult> PageDeploymentsAsync(
        IQueryable<DeploymentJob> query,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize <= 0 ? 25 : pageSize, 1, 100);
        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(cancellationToken);
        return Paged(rows.Select(ToResponse).ToArray(), page, pageSize, totalItems);
    }

    private static async Task<IResult> PageMaintenanceAsync(
        IQueryable<MaintenanceJob> query,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize <= 0 ? 25 : pageSize, 1, 100);
        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(cancellationToken);
        return Paged(rows.Select(ToResponse).ToArray(), page, pageSize, totalItems);
    }

    private static IQueryable<T> ApplyJobScope<T>(
        IQueryable<T> query,
        EffectiveAccess access,
        IReadOnlyCollection<Guid> effectiveGroupIds)
        where T : class
    {
        if (access.AllResources)
            return query;

        var orgIds = access.OrganizationIds.ToArray();
        var locationIds = access.LocationIds.ToArray();
        var groupIds = effectiveGroupIds.ToArray();

        return query switch
        {
            IQueryable<DeploymentJob> deployments => (IQueryable<T>)deployments.Where(x =>
                (x.TargetScopeType == "organization" && x.TargetScopeId != null && orgIds.Contains(x.TargetScopeId.Value))
                || (x.TargetScopeType == "location" && x.TargetScopeId != null && locationIds.Contains(x.TargetScopeId.Value))
                || (x.TargetScopeType == "device_group" && x.TargetScopeId != null && groupIds.Contains(x.TargetScopeId.Value))),
            IQueryable<AgentRollout> rollouts => (IQueryable<T>)rollouts.Where(x =>
                (x.TargetScopeType == "organization" && x.TargetScopeId != null && orgIds.Contains(x.TargetScopeId.Value))
                || (x.TargetScopeType == "location" && x.TargetScopeId != null && locationIds.Contains(x.TargetScopeId.Value))
                || (x.TargetScopeType == "device_group" && x.TargetScopeId != null && groupIds.Contains(x.TargetScopeId.Value))),
            IQueryable<MaintenanceJob> maintenance => (IQueryable<T>)maintenance.Where(x =>
                (x.TargetScopeType == "organization" && x.TargetScopeId != null && orgIds.Contains(x.TargetScopeId.Value))
                || (x.TargetScopeType == "location" && x.TargetScopeId != null && locationIds.Contains(x.TargetScopeId.Value))
                || (x.TargetScopeType == "device_group" && x.TargetScopeId != null && groupIds.Contains(x.TargetScopeId.Value))),
            _ => query.Where(_ => false)
        };
    }

    private static async Task<Guid[]> EffectiveGroupIdsAsync(
        DevicesDbContext db,
        EffectiveAccess access,
        CancellationToken cancellationToken)
    {
        if (access.AllResources)
            return Array.Empty<Guid>();

        var directGroupIds = access.DeviceGroupIds.ToArray();
        var orgIds = access.OrganizationIds.ToArray();
        var locationIds = access.LocationIds.ToArray();

        return await db.DeviceGroups.AsNoTracking()
            .Where(x =>
                directGroupIds.Contains(x.Id)
                || (x.OrganizationUnitId != null && orgIds.Contains(x.OrganizationUnitId.Value))
                || (x.LocationId != null && locationIds.Contains(x.LocationId.Value)))
            .Select(x => x.Id)
            .ToArrayAsync(cancellationToken);
    }

    private static async Task<TargetResolution> ResolveTargetAsync(
        string? scopeTypeInput,
        string? scopeIdInput,
        IReadOnlyCollection<string>? selectedDeviceIds,
        string? targetLabel,
        EffectiveAccess access,
        DevicesDbContext db,
        CancellationToken cancellationToken)
    {
        var scopeType = (scopeTypeInput ?? "device_group").Trim().ToLowerInvariant();
        switch (scopeType)
        {
            case "all_managed":
                if (!access.AllResources)
                    return TargetResolution.Forbidden();
                return TargetResolution.Ok(
                    "all_managed",
                    null,
                    JsonSerializer.Serialize(new { scopeType = "all_managed" }),
                    "All managed devices",
                    await db.Devices.AsNoTracking().CountAsync(cancellationToken));

            case "device_group":
                if (string.IsNullOrWhiteSpace(scopeIdInput)
                    || !OpaqueId.TryParse(scopeIdInput, "grp", out var groupId))
                    return TargetResolution.Validation("targetScopeId", "A valid Device Group is required.");
                var group = await db.DeviceGroups.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Id == groupId && x.Status == "active", cancellationToken);
                if (group is null)
                    return TargetResolution.Validation("targetScopeId", "Device Group was not found or is inactive.");
                var groupAllowed = access.AllResources
                    || access.DeviceGroupIds.Contains(groupId)
                    || (group.OrganizationUnitId is Guid groupOrgId && access.OrganizationIds.Contains(groupOrgId))
                    || (group.LocationId is Guid groupLocationId && access.LocationIds.Contains(groupLocationId));
                if (!groupAllowed)
                    return TargetResolution.Forbidden();
                var groupCount = await db.DeviceGroupMembers.AsNoTracking()
                    .CountAsync(x => x.GroupId == groupId, cancellationToken);
                return TargetResolution.Ok(
                    "device_group",
                    groupId,
                    JsonSerializer.Serialize(new { scopeType = "device_group", scopeId = OpaqueId.Format("grp", groupId) }),
                    group.Name,
                    groupCount);

            case "organization":
                if (string.IsNullOrWhiteSpace(scopeIdInput)
                    || !OpaqueId.TryParse(scopeIdInput, "org", out var organizationId))
                    return TargetResolution.Validation("targetScopeId", "A valid Organization is required.");
                if (!access.AllResources && !access.OrganizationIds.Contains(organizationId))
                    return TargetResolution.Forbidden();
                return TargetResolution.Ok(
                    "organization",
                    organizationId,
                    JsonSerializer.Serialize(new { scopeType = "organization", scopeId = OpaqueId.Format("org", organizationId) }),
                    string.IsNullOrWhiteSpace(targetLabel) ? "Organization scope" : targetLabel.Trim(),
                    await db.Devices.AsNoTracking().CountAsync(x => x.OrganizationUnitId == organizationId, cancellationToken));

            case "location":
                if (string.IsNullOrWhiteSpace(scopeIdInput)
                    || !OpaqueId.TryParse(scopeIdInput, "loc", out var locationId))
                    return TargetResolution.Validation("targetScopeId", "A valid Location is required.");
                if (!access.AllResources && !access.LocationIds.Contains(locationId))
                    return TargetResolution.Forbidden();
                return TargetResolution.Ok(
                    "location",
                    locationId,
                    JsonSerializer.Serialize(new { scopeType = "location", scopeId = OpaqueId.Format("loc", locationId) }),
                    string.IsNullOrWhiteSpace(targetLabel) ? "Location scope" : targetLabel.Trim(),
                    await db.Devices.AsNoTracking().CountAsync(x => x.LocationId == locationId, cancellationToken));

            case "selected_devices":
                if (!access.AllResources)
                    return TargetResolution.Forbidden();
                var parsedIds = new List<Guid>();
                foreach (var deviceId in selectedDeviceIds ?? Array.Empty<string>())
                {
                    if (!OpaqueId.TryParse(deviceId, "dev", out var parsed))
                        return TargetResolution.Validation("selectedDeviceIds", "Every selected device ID must be a canonical Device ID.");
                    parsedIds.Add(parsed);
                }
                if (parsedIds.Count == 0)
                    return TargetResolution.Validation("selectedDeviceIds", "Select at least one device.");
                var found = await db.Devices.AsNoTracking().CountAsync(x => parsedIds.Contains(x.Id), cancellationToken);
                if (found != parsedIds.Count)
                    return TargetResolution.Validation("selectedDeviceIds", "One or more selected devices were not found.");
                return TargetResolution.Ok(
                    "selected_devices",
                    null,
                    JsonSerializer.Serialize(new
                    {
                        scopeType = "selected_devices",
                        deviceIds = parsedIds.Select(x => OpaqueId.Format("dev", x)).ToArray()
                    }),
                    string.IsNullOrWhiteSpace(targetLabel) ? $"{parsedIds.Count} selected devices" : targetLabel.Trim(),
                    parsedIds.Count);

            default:
                return TargetResolution.Validation(
                    "targetScopeType",
                    "Target scope must be all_managed, device_group, organization, location or selected_devices.");
        }
    }

    private static (string? Mode, DateTimeOffset? ScheduledAt, IResult? Result) NormalizeSchedule(
        string? modeInput,
        DateTimeOffset? scheduledAt)
    {
        var mode = (modeInput ?? (scheduledAt is null ? "run_now" : "scheduled")).Trim().ToLowerInvariant();
        if (mode is not ("run_now" or "scheduled"))
            return (null, null, Validation("scheduleMode", "Schedule mode must be run_now or scheduled."));
        if (mode == "scheduled" && scheduledAt is null)
            return (null, null, Validation("scheduledAt", "Scheduled date/time is required."));
        if (mode == "scheduled" && scheduledAt <= DateTimeOffset.UtcNow)
            return (null, null, Validation("scheduledAt", "Scheduled date/time must be in the future."));
        return (mode, mode == "scheduled" ? scheduledAt : null, null);
    }

    private static async Task<(EffectiveAccess? Access, IResult? Result)> EvaluateAsync(
        HttpContext httpContext,
        IAccessEvaluator accessEvaluator,
        string permission,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, permission, cancellationToken);
        return access.Allowed
            ? (access, null)
            : (null, Problem(403, "Access denied", access.Reason));
    }

    private static async Task CompleteCreationOperationAsync(
        DeviceLedgerWriter ledger,
        Guid operationId,
        string operationType,
        string resourceType,
        Guid resourceId,
        Guid actorUserId,
        string resultUrl,
        CancellationToken cancellationToken)
    {
        await ledger.CreateOperationAsync(
            operationId,
            operationType,
            resourceType,
            resourceId,
            OpaqueId.Format("user", actorUserId),
            operationType.StartsWith("devices.restart", StringComparison.Ordinal)
                ? "devices.manage"
                : "devices.deploy",
            cancellationToken);
        await ledger.UpdateOperationAsync(
            operationId,
            "succeeded",
            100,
            resultUrl,
            null,
            cancellationToken);
    }

    private static DeploymentJobResponse ToResponse(DeploymentJob x) =>
        new(
            OpaqueId.Format("dep", x.Id),
            x.JobNumber,
            x.DeploymentType,
            x.TargetLabel,
            x.PayloadName,
            x.ProfileOrDestination,
            x.ScheduleMode,
            x.ScheduledAt,
            x.MaintenanceWindow,
            x.RetryAttempts,
            x.RestartPolicy,
            x.Status,
            x.TargetCount,
            x.CompletedCount,
            x.FailedCount,
            x.CreatedAt,
            x.StartedAt,
            x.CompletedAt);

    private static MaintenanceJobResponse ToResponse(MaintenanceJob x) =>
        new(
            OpaqueId.Format("mnt", x.Id),
            x.JobNumber,
            x.MaintenanceType,
            x.Action,
            x.PackageName,
            x.TargetLabel,
            x.ScheduleMode,
            x.ScheduledAt,
            x.MaintenanceWindow,
            x.RetryAttempts,
            x.RestartPolicy,
            x.GraceMinutes,
            x.UserMessage,
            x.OfflinePolicy,
            x.Status,
            x.TargetCount,
            x.CompletedCount,
            x.FailedCount,
            x.CreatedAt,
            x.StartedAt,
            x.CompletedAt);

    private static string? NormalizeOne(string? value, params string[] allowed)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return normalized is not null && allowed.Contains(normalized) ? normalized : null;
    }

    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string JobNumber(string prefix, DateTimeOffset now, Guid id) =>
        $"{prefix}-{now:yyMMdd}-{id.ToString("N")[..6].ToUpperInvariant()}";

    private static IResult Paged<T>(IReadOnlyCollection<T> items, int page, int pageSize, int totalItems) =>
        Results.Ok(new
        {
            items,
            page,
            pageSize,
            totalItems,
            totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)pageSize))
        });

    private static object Accepted(Guid operationId, string resultUrl, string resourceId) => new
    {
        operationId = OpaqueId.Format("op", operationId),
        status = "succeeded",
        statusUrl = $"/api/v1/operations/{OpaqueId.Format("op", operationId)}",
        progress = 100,
        resourceId,
        resultUrl
    };

    private static IResult Problem(int status, string title, string detail) =>
        Results.Problem(statusCode: status, title: title, detail: detail);

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    public sealed record CreateDeploymentRequest(
        string? DeploymentType,
        string? TargetScopeType,
        string? TargetScopeId,
        IReadOnlyCollection<string>? SelectedDeviceIds,
        string? TargetLabel,
        string? PayloadName,
        string? ProfileOrDestination,
        string? ScheduleMode,
        DateTimeOffset? ScheduledAt,
        string? MaintenanceWindow,
        int? RetryAttempts,
        string? RestartPolicy);

    public sealed record CreateAgentRolloutRequest(
        string? ReleaseVersion,
        string? TargetScopeType,
        string? TargetScopeId,
        IReadOnlyCollection<string>? SelectedDeviceIds,
        string? TargetLabel,
        string? MaintenanceWindow,
        int? RetryAttempts,
        int? PauseFailureThresholdPercent);

    public sealed record CreateSoftwareMaintenanceRequest(
        string? Action,
        string? PackageName,
        string? TargetScopeType,
        string? TargetScopeId,
        IReadOnlyCollection<string>? SelectedDeviceIds,
        string? TargetLabel,
        string? ScheduleMode,
        DateTimeOffset? ScheduledAt,
        string? MaintenanceWindow,
        int? RetryAttempts,
        string? RestartPolicy);

    public sealed record CreateRestartJobRequest(
        string? TargetScopeType,
        string? TargetScopeId,
        IReadOnlyCollection<string>? SelectedDeviceIds,
        string? TargetLabel,
        DateTimeOffset? ScheduledAt,
        int? GraceMinutes,
        string? UserMessage,
        string? OfflinePolicy);

    public sealed record DeploymentJobResponse(
        string Id,
        string JobNumber,
        string DeploymentType,
        string TargetLabel,
        string PayloadName,
        string? ProfileOrDestination,
        string ScheduleMode,
        DateTimeOffset? ScheduledAt,
        string? MaintenanceWindow,
        int RetryAttempts,
        string? RestartPolicy,
        string Status,
        int TargetCount,
        int CompletedCount,
        int FailedCount,
        DateTimeOffset CreatedAt,
        DateTimeOffset? StartedAt,
        DateTimeOffset? CompletedAt);

    public sealed record AgentRolloutResponse(
        string Id,
        string RolloutNumber,
        string ReleaseVersion,
        string TargetLabel,
        string? MaintenanceWindow,
        int RetryAttempts,
        int PauseFailureThresholdPercent,
        string Status,
        int TargetCount,
        int CompletedCount,
        int FailedCount,
        DateTimeOffset CreatedAt,
        DateTimeOffset? StartedAt,
        DateTimeOffset? CompletedAt);

    public sealed record MaintenanceJobResponse(
        string Id,
        string JobNumber,
        string MaintenanceType,
        string? Action,
        string? PackageName,
        string TargetLabel,
        string ScheduleMode,
        DateTimeOffset? ScheduledAt,
        string? MaintenanceWindow,
        int RetryAttempts,
        string? RestartPolicy,
        int? GraceMinutes,
        string? UserMessage,
        string? OfflinePolicy,
        string Status,
        int TargetCount,
        int CompletedCount,
        int FailedCount,
        DateTimeOffset CreatedAt,
        DateTimeOffset? StartedAt,
        DateTimeOffset? CompletedAt);

    public sealed record MaintenanceHistoryItem(
        string Id,
        string JobNumber,
        string Type,
        string Summary,
        string TargetLabel,
        int Succeeded,
        int Failed,
        string Status,
        DateTimeOffset CreatedAt,
        DateTimeOffset? CompletedAt);

    private sealed record TargetResolution(
        string? ScopeType,
        Guid? ScopeId,
        string? DefinitionJson,
        string? Label,
        int TargetCount,
        IResult? Result)
    {
        public static TargetResolution Ok(
            string scopeType,
            Guid? scopeId,
            string definitionJson,
            string label,
            int targetCount) =>
            new(scopeType, scopeId, definitionJson, label, targetCount, null);

        public static TargetResolution Forbidden() =>
            new(null, null, null, null, 0, Problem(403, "Access denied", "OUTSIDE_ASSIGNED_SCOPE"));

        public static TargetResolution Validation(string field, string message) =>
            new(null, null, null, null, 0, DeviceMaintenanceEndpoints.Validation(field, message));
    }
}
