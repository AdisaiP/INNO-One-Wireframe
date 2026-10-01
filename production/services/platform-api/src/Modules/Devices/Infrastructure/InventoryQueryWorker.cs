using System.Text.Json;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace INNO.One.Modules.Devices.Infrastructure;

public sealed class InventoryQueryWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<InventoryQueryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ResetInterruptedRunsAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var processed = await ProcessNextAsync(stoppingToken);
            if (!processed)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(600), stoppingToken);
            }
        }
    }

    private async Task ResetInterruptedRunsAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DevicesDbContext>();
        var runs = await db.InventoryQueryRuns
            .Where(x => x.Status == "running" && x.CompletedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var run in runs)
        {
            run.Status = "queued";
            run.Progress = 0;
            run.StartedAt = null;
            run.UpdatedAt = DateTimeOffset.UtcNow;
        }

        if (runs.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<bool> ProcessNextAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DevicesDbContext>();
        var ledger = scope.ServiceProvider.GetRequiredService<DeviceLedgerWriter>();

        var run = await db.InventoryQueryRuns
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(x => x.Status == "queued", cancellationToken);
        if (run is null)
        {
            return false;
        }

        run.Status = "running";
        run.Progress = 5;
        run.StartedAt = DateTimeOffset.UtcNow;
        run.UpdatedAt = run.StartedAt.Value;
        await db.SaveChangesAsync(cancellationToken);
        await ledger.UpdateOperationAsync(
            run.OperationId, "running", run.Progress, null, null, cancellationToken);

        try
        {
            var definition = JsonSerializer.Deserialize<InventoryQueryDefinition>(
                run.DefinitionJson)
                ?? throw new InvalidOperationException("Inventory query definition is missing.");
            var access = JsonSerializer.Deserialize<InventoryQueryAccessScope>(
                run.AccessScopeJson)
                ?? throw new InvalidOperationException("Inventory query access scope is missing.");

            if (definition.FactType != "software")
            {
                throw new InvalidOperationException("Unsupported inventory fact type.");
            }

            await db.InventoryQueryResults
                .Where(x => x.RunId == run.Id)
                .ExecuteDeleteAsync(cancellationToken);

            IQueryable<Device> deviceQuery = db.Devices.AsNoTracking();
            deviceQuery = ApplyAccessScope(deviceQuery, db, access);

            if (definition.ScopeType == "group" && definition.ScopeId.HasValue)
            {
                var groupId = definition.ScopeId.Value;
                deviceQuery = deviceQuery.Where(device =>
                    db.DeviceGroupMembers.Any(member =>
                        member.GroupId == groupId && member.DeviceId == device.Id));
            }

            var devices = await deviceQuery
                .OrderBy(x => x.Hostname)
                .ToListAsync(cancellationToken);

            run.DevicesEvaluated = devices.Count;
            run.Progress = 20;
            run.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            await ledger.UpdateOperationAsync(
                run.OperationId, "running", run.Progress, null, null, cancellationToken);

            var deviceIds = devices.Select(x => x.Id).ToArray();
            var snapshots = await db.SoftwareInventorySnapshots.AsNoTracking()
                .Where(x => deviceIds.Contains(x.DeviceId))
                .OrderByDescending(x => x.ObservedAt)
                .ToListAsync(cancellationToken);
            var latestByDevice = snapshots
                .GroupBy(x => x.DeviceId)
                .ToDictionary(x => x.Key, x => x.First());
            var snapshotIds = latestByDevice.Values.Select(x => x.Id).ToArray();
            var packages = await db.InstalledSoftware.AsNoTracking()
                .Where(x => snapshotIds.Contains(x.SnapshotId))
                .OrderBy(x => x.DisplayName)
                .ToListAsync(cancellationToken);
            var packagesBySnapshot = packages
                .GroupBy(x => x.SnapshotId)
                .ToDictionary(x => x.Key, x => x.ToList());

            var matchedDevices = 0;
            var processedDevices = 0;
            foreach (var device in devices)
            {
                cancellationToken.ThrowIfCancellationRequested();
                processedDevices++;

                DeviceInstalledSoftware? match = null;
                DeviceSoftwareInventorySnapshot? snapshot = null;
                if (latestByDevice.TryGetValue(device.Id, out snapshot)
                    && packagesBySnapshot.TryGetValue(snapshot.Id, out var devicePackages))
                {
                    match = devicePackages.FirstOrDefault(package =>
                        Matches(package, definition));
                }

                if (match is not null && snapshot is not null)
                {
                    matchedDevices++;
                    db.InventoryQueryResults.Add(new InventoryQueryResult
                    {
                        Id = Guid.NewGuid(),
                        RunId = run.Id,
                        DeviceId = device.Id,
                        FactType = "software",
                        FactName = match.DisplayName,
                        FactVersion = match.Version,
                        FactPublisher = match.Publisher,
                        MatchedValue = MatchedValue(match, definition.Field),
                        ObservedAt = snapshot.ObservedAt
                    });
                }

                var total = Math.Max(devices.Count, 1);
                run.Progress = 20 + (int)Math.Round(processedDevices * 70d / total);
                run.MatchCount = matchedDevices;
                run.UpdatedAt = DateTimeOffset.UtcNow;
            }

            run.Status = "succeeded";
            run.Progress = 100;
            run.MatchCount = matchedDevices;
            run.CompletedAt = DateTimeOffset.UtcNow;
            run.UpdatedAt = run.CompletedAt.Value;
            await db.SaveChangesAsync(cancellationToken);

            await ledger.UpdateOperationAsync(
                run.OperationId,
                "succeeded",
                100,
                OpaqueId.Format("iqr", run.Id),
                null,
                cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Inventory query run {RunId} failed.", run.Id);
            run.Status = "failed";
            run.ErrorCode = "INVENTORY_QUERY_FAILED";
            run.CompletedAt = DateTimeOffset.UtcNow;
            run.UpdatedAt = run.CompletedAt.Value;
            await db.SaveChangesAsync(cancellationToken);
            await ledger.UpdateOperationAsync(
                run.OperationId,
                "failed",
                run.Progress,
                null,
                run.ErrorCode,
                cancellationToken);
        }

        return true;
    }

    private static IQueryable<Device> ApplyAccessScope(
        IQueryable<Device> query,
        DevicesDbContext db,
        InventoryQueryAccessScope access)
    {
        if (access.AllResources)
        {
            return query;
        }

        var organizations = access.OrganizationIds;
        var locations = access.LocationIds;
        var groups = access.DeviceGroupIds;

        return query.Where(device =>
            (device.OrganizationUnitId.HasValue
                && organizations.Contains(device.OrganizationUnitId.Value))
            || (device.LocationId.HasValue
                && locations.Contains(device.LocationId.Value))
            || db.DeviceGroupMembers.Any(member =>
                groups.Contains(member.GroupId)
                && member.DeviceId == device.Id));
    }

    private static bool Matches(
        DeviceInstalledSoftware package,
        InventoryQueryDefinition definition)
    {
        var candidate = definition.Field switch
        {
            "name" => package.DisplayName,
            "version" => package.Version ?? "",
            "publisher" => package.Publisher ?? "",
            _ => ""
        };

        return definition.Operator switch
        {
            "contains" => candidate.Contains(
                definition.Value, StringComparison.OrdinalIgnoreCase),
            "equals" => string.Equals(
                candidate, definition.Value, StringComparison.OrdinalIgnoreCase),
            "version_less_than" => CompareVersions(
                candidate, definition.Value) < 0,
            _ => false
        };
    }

    private static string MatchedValue(
        DeviceInstalledSoftware package,
        string field) =>
        field switch
        {
            "version" => package.Version ?? "Unknown version",
            "publisher" => package.Publisher ?? "Unknown publisher",
            _ => package.DisplayName
        };

    private static int CompareVersions(string left, string right)
    {
        if (Version.TryParse(left, out var leftVersion)
            && Version.TryParse(right, out var rightVersion))
        {
            return leftVersion.CompareTo(rightVersion);
        }

        var leftParts = VersionParts(left);
        var rightParts = VersionParts(right);
        var length = Math.Max(leftParts.Length, rightParts.Length);
        for (var index = 0; index < length; index++)
        {
            var leftPart = index < leftParts.Length ? leftParts[index] : 0;
            var rightPart = index < rightParts.Length ? rightParts[index] : 0;
            var comparison = leftPart.CompareTo(rightPart);
            if (comparison != 0)
            {
                return comparison;
            }
        }

        return string.Compare(left, right, StringComparison.OrdinalIgnoreCase);
    }

    private static int[] VersionParts(string value) =>
        value.Split('.', '-', '_')
            .Select(part => int.TryParse(part, out var number) ? number : 0)
            .ToArray();
}
