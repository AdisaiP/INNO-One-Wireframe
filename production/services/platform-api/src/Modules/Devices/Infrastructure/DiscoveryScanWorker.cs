using System.Net;
using System.Net.NetworkInformation;
using System.Text.Json;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace INNO.One.Modules.Devices.Infrastructure;

public sealed class DiscoveryScanWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<DiscoveryScanWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ResetInterruptedScansAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var processed = await ProcessNextAsync(stoppingToken);
            if (!processed)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(750), stoppingToken);
            }
        }
    }

    private async Task ResetInterruptedScansAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DevicesDbContext>();
        var scans = await db.DiscoveryScans
            .Where(x => x.Status == "running" && x.CompletedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var scan in scans)
        {
            scan.Status = "queued";
            scan.Progress = 0;
            scan.StartedAt = null;
            scan.UpdatedAt = DateTimeOffset.UtcNow;
        }

        if (scans.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<bool> ProcessNextAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DevicesDbContext>();
        var ledger = scope.ServiceProvider.GetRequiredService<DeviceLedgerWriter>();

        var scan = await db.DiscoveryScans
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(x => x.Status == "queued", cancellationToken);

        if (scan is null)
        {
            return false;
        }

        scan.Status = "running";
        scan.StartedAt = DateTimeOffset.UtcNow;
        scan.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        await ledger.UpdateOperationAsync(
            scan.OperationId, "running", 0, null, null, cancellationToken);

        try
        {
            var ranges = JsonSerializer.Deserialize<string[]>(scan.RangesJson) ?? [];
            if (!PrivateNetworkRange.TryExpand(ranges, out var addresses, out var validationError))
            {
                throw new InvalidOperationException(validationError);
            }

            var existingByIp = await db.Devices.AsNoTracking()
                .Where(x => x.IpAddress != null)
                .ToDictionaryAsync(
                    x => x.IpAddress!,
                    x => x.Id,
                    StringComparer.OrdinalIgnoreCase,
                    cancellationToken);

            var total = Math.Max(addresses.Count, 1);
            var found = 0;
            var unmanaged = 0;
            var scanned = 0;

            foreach (var address in addresses)
            {
                cancellationToken.ThrowIfCancellationRequested();
                scanned++;

                var reachable = false;
                try
                {
                    using var ping = new Ping();
                    var reply = await ping.SendPingAsync(address.ToString(), 300);
                    reachable = reply.Status == IPStatus.Success;
                }
                catch (PingException)
                {
                    // Endpoint can still exist while ICMP is blocked; the discovery contract
                    // records only positively reachable candidates in this first implementation.
                }

                if (reachable)
                {
                    found++;
                    var ip = address.ToString();
                    var isManaged = existingByIp.TryGetValue(ip, out var matchedDeviceId);
                    if (!isManaged)
                    {
                        unmanaged++;
                    }

                    db.DiscoveryResults.Add(new DiscoveryResult
                    {
                        Id = Guid.NewGuid(),
                        ScanId = scan.Id,
                        IpAddress = ip,
                        Hostname = address.Equals(IPAddress.Loopback) ? "localhost" : null,
                        DetectedOperatingSystem = null,
                        Vendor = null,
                        DiscoveryMethod = "icmp",
                        ManagementStatus = isManaged ? "managed" : "unmanaged",
                        MatchedDeviceId = isManaged ? matchedDeviceId : null,
                        DiscoveredAt = DateTimeOffset.UtcNow
                    });
                }

                if (scanned % 16 == 0 || scanned == addresses.Count)
                {
                    scan.Progress = (int)Math.Round(scanned * 100d / total);
                    scan.AddressesScanned = scanned;
                    scan.DevicesFound = found;
                    scan.UnmanagedCount = unmanaged;
                    scan.UpdatedAt = DateTimeOffset.UtcNow;
                    await db.SaveChangesAsync(cancellationToken);
                    await ledger.UpdateOperationAsync(
                        scan.OperationId,
                        "running",
                        scan.Progress,
                        null,
                        null,
                        cancellationToken);
                }
            }

            scan.Status = "succeeded";
            scan.Progress = 100;
            scan.AddressesScanned = scanned;
            scan.DevicesFound = found;
            scan.UnmanagedCount = unmanaged;
            scan.CompletedAt = DateTimeOffset.UtcNow;
            scan.UpdatedAt = scan.CompletedAt.Value;
            await db.SaveChangesAsync(cancellationToken);

            await ledger.UpdateOperationAsync(
                scan.OperationId,
                "succeeded",
                100,
                OpaqueId.Format("scan", scan.Id),
                null,
                cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Discovery scan {ScanId} failed.", scan.Id);
            scan.Status = "failed";
            scan.ErrorCode = "DISCOVERY_FAILED";
            scan.CompletedAt = DateTimeOffset.UtcNow;
            scan.UpdatedAt = scan.CompletedAt.Value;
            await db.SaveChangesAsync(cancellationToken);
            await ledger.UpdateOperationAsync(
                scan.OperationId,
                "failed",
                scan.Progress,
                null,
                scan.ErrorCode,
                cancellationToken);
        }

        return true;
    }
}
