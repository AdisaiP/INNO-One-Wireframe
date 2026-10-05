using INNO.One.Contracts.Reports;
using INNO.One.Modules.Reports.Application;
using INNO.One.Modules.Reports.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace INNO.One.Modules.Reports.Infrastructure;

public sealed class ReportScheduleWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<ReportScheduleWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDueSchedulesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Reports schedule worker cycle failed.");
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken))
            {
                break;
            }
        }
    }

    private async Task ProcessDueSchedulesAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ReportsDbContext>();
        var generator = scope.ServiceProvider.GetRequiredService<IReportGenerationService>();
        var now = DateTimeOffset.UtcNow;

        var due = await db.ReportSchedules
            .Where(x => x.IsEnabled
                && x.NextRunAt.HasValue
                && x.NextRunAt <= now)
            .OrderBy(x => x.NextRunAt)
            .Take(10)
            .ToListAsync(cancellationToken);

        foreach (var schedule in due)
        {
            var result = await generator.GenerateAsync(
                new ReportGenerationRequest(
                    schedule.ReportId,
                    schedule.CreatedByUserId,
                    schedule.CreatedBySubject,
                    $"reports-schedule:{schedule.Id:N}:{now:yyyyMMddHHmm}",
                    null,
                    "schedule"),
                cancellationToken);

            schedule.LastRunAt = now;
            schedule.LastRunId = result.RunId;
            schedule.NextRunAt = ReportScheduleClock.NextOccurrence(
                schedule.Cadence,
                schedule.TimeZoneId,
                schedule.Hour,
                schedule.Minute,
                schedule.DayOfWeek,
                schedule.DayOfMonth,
                now.AddSeconds(1));
            schedule.UpdatedAt = DateTimeOffset.UtcNow;
            schedule.Version++;

            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
