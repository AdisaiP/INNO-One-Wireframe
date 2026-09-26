using System.Text.Json;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Helpdesk.Domain;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace INNO.One.Modules.Helpdesk.Infrastructure;

public sealed class HelpdeskSlaAutomationWorker(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<HelpdeskSlaAutomationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var intervalSeconds = Math.Clamp(
            configuration.GetValue("Helpdesk:SlaEvaluationIntervalSeconds", 30),
            3,
            300);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await EvaluateAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Helpdesk SLA/automation evaluation failed.");
            }

            await Task.Delay(
                TimeSpan.FromSeconds(intervalSeconds),
                stoppingToken);
        }
    }

    public async Task EvaluateAsync(
        CancellationToken cancellationToken = default)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HelpdeskDbContext>();
        var ledger = scope.ServiceProvider.GetRequiredService<HelpdeskLedgerWriter>();
        var businessTime = scope.ServiceProvider.GetRequiredService<BusinessTimeCalculator>();

        await EvaluateSlaAsync(
            db,
            ledger,
            businessTime,
            cancellationToken);

        await EvaluateAutomationAsync(
            db,
            businessTime,
            cancellationToken);
    }

    private static async Task EvaluateSlaAsync(
        HelpdeskDbContext db,
        HelpdeskLedgerWriter ledger,
        BusinessTimeCalculator businessTime,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var defaultCalendarId = await businessTime.GetDefaultCalendarIdAsync(cancellationToken);

        var openTickets = await db.Tickets
            .Where(x => x.ResolvedAt == null)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        if (openTickets.Count == 0)
        {
            return;
        }

        var ticketIds = openTickets.Select(x => x.Id).ToArray();
        var statusIds = openTickets.Select(x => x.StatusId).Distinct().ToArray();
        var statuses = await db.Statuses.AsNoTracking()
            .Where(x => statusIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Code, cancellationToken);
        var ticketSlas = await db.TicketSla
            .Where(x => ticketIds.Contains(x.TicketId))
            .ToDictionaryAsync(x => x.TicketId, cancellationToken);
        var policyIds = ticketSlas.Values.Select(x => x.PolicyId).Distinct().ToArray();
        var policies = await db.SlaPolicies.AsNoTracking()
            .Where(x => policyIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var ticket in openTickets)
        {
            if (!ticketSlas.TryGetValue(ticket.Id, out var ticketSla)
                || !policies.TryGetValue(ticketSla.PolicyId, out var policy))
            {
                continue;
            }

            var calendarId = policy.BusinessCalendarId ?? defaultCalendarId;
            var statusCode = statuses.GetValueOrDefault(ticket.StatusId) ?? string.Empty;
            var waiting = policy.PauseOnRequesterWait
                && string.Equals(statusCode, "waiting", StringComparison.OrdinalIgnoreCase);

            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

            if (waiting)
            {
                if (!ticketSla.PausedAt.HasValue)
                {
                    ticketSla.PausedAt = now;
                    ticketSla.State = "paused";
                }

                ticketSla.LastEvaluatedAt = now;
                ticketSla.UpdatedAt = now;
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                continue;
            }

            if (ticketSla.PausedAt is DateTimeOffset pausedAt)
            {
                var pausedBusinessMinutes = await businessTime.CountBusinessMinutesAsync(
                    pausedAt,
                    now,
                    calendarId,
                    cancellationToken);

                if (pausedBusinessMinutes > 0)
                {
                    ticketSla.AccumulatedPausedSeconds += pausedBusinessMinutes * 60L;
                    ticketSla.ResponseDueAt = await businessTime.AddBusinessMinutesAsync(
                        ticketSla.ResponseDueAt,
                        pausedBusinessMinutes,
                        calendarId,
                        cancellationToken);
                    ticketSla.ResolutionDueAt = await businessTime.AddBusinessMinutesAsync(
                        ticketSla.ResolutionDueAt,
                        pausedBusinessMinutes,
                        calendarId,
                        cancellationToken);
                }

                ticketSla.PausedAt = null;
            }

            var elapsedBusinessMinutes = await businessTime.CountBusinessMinutesAsync(
                ticket.CreatedAt,
                now,
                calendarId,
                cancellationToken);
            elapsedBusinessMinutes = Math.Max(
                0,
                elapsedBusinessMinutes - (int)(ticketSla.AccumulatedPausedSeconds / 60L));

            var elapsedPercent = policy.ResolutionMinutes <= 0
                ? 100
                : (int)Math.Floor(
                    elapsedBusinessMinutes * 100d / policy.ResolutionMinutes);

            var nextState = elapsedPercent >= 100
                ? "breached"
                : elapsedPercent >= 75
                    ? "at_risk"
                    : "active";

            var publicTicketId = OpaqueId.Format("ticket", ticket.Id);
            var publicPolicyId = OpaqueId.Format("sla", policy.Id);

            if (elapsedPercent >= 75 && !ticketSla.RiskEmittedAt.HasValue)
            {
                ticketSla.RiskEmittedAt = now;
                await ledger.AppendOutboxAsync(
                    "sla.at_risk",
                    "ticket",
                    publicTicketId,
                    new
                    {
                        ticketId = publicTicketId,
                        slaPolicyId = publicPolicyId,
                        targetType = "resolution",
                        elapsedPercent,
                        dueAt = ticketSla.ResolutionDueAt
                    },
                    null,
                    null,
                    null,
                    cancellationToken);
            }

            var escalationLevels = ParseEscalationLevels(policy.EscalationLevelsJson);
            var targetLevel = escalationLevels
                .Where(x => elapsedPercent >= x.Percent)
                .OrderBy(x => x.Level)
                .LastOrDefault();

            if (targetLevel is not null
                && targetLevel.Level > ticketSla.EscalationLevel)
            {
                var levelsToEmit = escalationLevels
                    .Where(x =>
                        x.Level > ticketSla.EscalationLevel
                        && x.Level <= targetLevel.Level
                        && elapsedPercent >= x.Percent)
                    .OrderBy(x => x.Level)
                    .ToArray();

                foreach (var level in levelsToEmit)
                {
                    await ledger.AppendOutboxAsync(
                        "sla.escalated",
                        "ticket",
                        publicTicketId,
                        new
                        {
                            ticketId = publicTicketId,
                            slaPolicyId = publicPolicyId,
                            level = level.Level,
                            escalatedToType = level.TargetType,
                            escalatedToId = level.TargetId
                        },
                        null,
                        null,
                        null,
                        cancellationToken);

                    if (policy.ReassignOnBreach
                        && level.Percent >= 100
                        && !string.IsNullOrWhiteSpace(level.ReassignTeam)
                        && !string.Equals(
                            ticket.AssigneeTeam,
                            level.ReassignTeam,
                            StringComparison.Ordinal))
                    {
                        var previousAssignee = ticket.AssigneeUserId;
                        ticket.AssigneeUserId = null;
                        ticket.AssigneeTeam = level.ReassignTeam;
                        ticket.Version++;
                        ticket.UpdatedAt = now;

                        db.TicketAssignments.Add(new TicketAssignment
                        {
                            Id = Guid.NewGuid(),
                            TicketId = ticket.Id,
                            PreviousAssigneeUserId = previousAssignee,
                            AssigneeUserId = null,
                            Team = level.ReassignTeam,
                            AssignedByUserId = Guid.Empty,
                            Note = "Automatic SLA breach escalation",
                            AssignedAt = now
                        });
                    }
                }

                ticketSla.EscalationLevel = targetLevel.Level;
            }

            ticketSla.State = nextState;
            ticketSla.LastEvaluatedAt = now;
            ticketSla.UpdatedAt = now;

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
    }

    private static async Task EvaluateAutomationAsync(
        HelpdeskDbContext db,
        BusinessTimeCalculator businessTime,
        CancellationToken cancellationToken)
    {
        var rules = await db.AutomationRules.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);
        if (rules.Count == 0)
        {
            return;
        }

        var tickets = await db.Tickets
            .Where(x => x.ResolvedAt == null)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        if (tickets.Count == 0)
        {
            return;
        }

        var ticketIds = tickets.Select(x => x.Id).ToArray();
        var ticketSlas = await db.TicketSla
            .Where(x => ticketIds.Contains(x.TicketId))
            .ToDictionaryAsync(x => x.TicketId, cancellationToken);
        var categoryIds = tickets
            .Where(x => x.CategoryId.HasValue)
            .Select(x => x.CategoryId!.Value)
            .Distinct()
            .ToArray();
        var categories = await db.Categories.AsNoTracking()
            .Where(x => categoryIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        var statusIds = tickets.Select(x => x.StatusId).Distinct().ToArray();
        var statuses = await db.Statuses.AsNoTracking()
            .Where(x => statusIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Code, cancellationToken);
        var defaultCalendarId = await businessTime.GetDefaultCalendarIdAsync(cancellationToken);

        foreach (var rule in rules)
        {
            foreach (var ticket in tickets)
            {
                if (!TriggerOccurred(rule, ticket, ticketSlas.GetValueOrDefault(ticket.Id)))
                {
                    continue;
                }

                if (await db.AutomationExecutions.AsNoTracking().AnyAsync(
                    x => x.RuleId == rule.Id
                        && x.TicketId == ticket.Id
                        && x.Trigger == rule.Trigger,
                    cancellationToken))
                {
                    continue;
                }

                var category = ticket.CategoryId is Guid categoryId
                    ? categories.GetValueOrDefault(categoryId)
                    : null;
                var matched = await MatchesAsync(
                    rule,
                    ticket,
                    category,
                    statuses.GetValueOrDefault(ticket.StatusId),
                    businessTime,
                    defaultCalendarId,
                    cancellationToken);

                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                var result = matched ? "applied" : "skipped";
                string? detailJson = null;

                if (matched)
                {
                    detailJson = await ApplyActionAsync(
                        rule,
                        ticket,
                        ticketSlas.GetValueOrDefault(ticket.Id),
                        db,
                        businessTime,
                        defaultCalendarId,
                        cancellationToken);
                }

                db.AutomationExecutions.Add(new AutomationExecution
                {
                    Id = Guid.NewGuid(),
                    RuleId = rule.Id,
                    TicketId = ticket.Id,
                    Trigger = rule.Trigger,
                    Result = result,
                    DetailJson = detailJson,
                    ExecutedAt = DateTimeOffset.UtcNow
                });

                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
        }
    }

    private static bool TriggerOccurred(
        AutomationRule rule,
        Ticket ticket,
        TicketSla? ticketSla) =>
        rule.Trigger switch
        {
            "ticket_created" => ticket.CreatedAt >= rule.CreatedAt,
            "ticket_updated" => ticket.UpdatedAt >= rule.CreatedAt,
            "sla_at_risk" => ticketSla?.RiskEmittedAt is DateTimeOffset riskAt
                && riskAt >= rule.CreatedAt,
            "status_changed" => ticket.UpdatedAt >= rule.CreatedAt,
            _ => false
        };

    private static async Task<bool> MatchesAsync(
        AutomationRule rule,
        Ticket ticket,
        Category? category,
        string? statusCode,
        BusinessTimeCalculator businessTime,
        Guid? defaultCalendarId,
        CancellationToken cancellationToken)
    {
        var scopeMatches = rule.ScopeType switch
        {
            "all" => true,
            "priority" => string.Equals(
                ticket.Priority,
                rule.ScopeValue,
                StringComparison.OrdinalIgnoreCase),
            "category" => category is not null
                && (string.Equals(
                        category.Code,
                        rule.ScopeValue,
                        StringComparison.OrdinalIgnoreCase)
                    || string.Equals(
                        category.Name,
                        rule.ScopeValue,
                        StringComparison.OrdinalIgnoreCase)),
            _ => true
        };

        if (!scopeMatches)
        {
            return false;
        }

        string actual;
        switch (rule.ConditionField)
        {
            case "priority":
                actual = ticket.Priority;
                break;
            case "category":
                actual = category?.Code ?? string.Empty;
                break;
            case "status":
                actual = statusCode ?? string.Empty;
                break;
            case "business_calendar":
                var working = await businessTime.IsWorkingTimeAsync(
                    ticket.CreatedAt,
                    defaultCalendarId,
                    cancellationToken);
                actual = working ? "inside" : "outside";
                break;
            default:
                actual = string.Empty;
                break;
        }

        return rule.ConditionOperator switch
        {
            "contains" => actual.Contains(
                rule.ConditionValue,
                StringComparison.OrdinalIgnoreCase),
            _ => string.Equals(
                actual,
                rule.ConditionValue,
                StringComparison.OrdinalIgnoreCase)
        };
    }

    private static async Task<string?> ApplyActionAsync(
        AutomationRule rule,
        Ticket ticket,
        TicketSla? ticketSla,
        HelpdeskDbContext db,
        BusinessTimeCalculator businessTime,
        Guid? defaultCalendarId,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        switch (rule.ActionType)
        {
            case "assign_team":
                var previousAssignee = ticket.AssigneeUserId;
                ticket.AssigneeUserId = null;
                ticket.AssigneeTeam = rule.ActionValue;
                ticket.Version++;
                ticket.UpdatedAt = now;
                db.TicketAssignments.Add(new TicketAssignment
                {
                    Id = Guid.NewGuid(),
                    TicketId = ticket.Id,
                    PreviousAssigneeUserId = previousAssignee,
                    AssigneeUserId = null,
                    Team = rule.ActionValue,
                    AssignedByUserId = Guid.Empty,
                    Note = "Automation: " + rule.Name,
                    AssignedAt = now
                });
                return JsonSerializer.Serialize(new
                {
                    action = "assign_team",
                    team = rule.ActionValue
                });

            case "set_priority" when rule.ActionValue is "P1" or "P2" or "P3" or "P4":
                ticket.Priority = rule.ActionValue;
                ticket.Version++;
                ticket.UpdatedAt = now;

                if (ticketSla is not null)
                {
                    var policy = await db.SlaPolicies.AsNoTracking()
                        .Where(x =>
                            x.IsActive
                            && x.Priority == rule.ActionValue)
                        .OrderBy(x => x.Code)
                        .FirstOrDefaultAsync(cancellationToken);
                    if (policy is not null)
                    {
                        var calendarId = policy.BusinessCalendarId ?? defaultCalendarId;
                        ticketSla.PolicyId = policy.Id;
                        ticketSla.ResponseDueAt = await businessTime.AddBusinessMinutesAsync(
                            ticket.CreatedAt,
                            policy.ResponseMinutes,
                            calendarId,
                            cancellationToken);
                        ticketSla.ResolutionDueAt = await businessTime.AddBusinessMinutesAsync(
                            ticket.CreatedAt,
                            policy.ResolutionMinutes,
                            calendarId,
                            cancellationToken);
                        ticketSla.State = "active";
                        ticketSla.RiskEmittedAt = null;
                        ticketSla.EscalationLevel = 0;
                        ticketSla.UpdatedAt = now;
                    }
                }

                return JsonSerializer.Serialize(new
                {
                    action = "set_priority",
                    priority = rule.ActionValue
                });

            case "escalate_manager_chain":
                if (ticketSla is not null && ticketSla.EscalationLevel > 0)
                {
                    ticket.AssigneeUserId = null;
                    ticket.AssigneeTeam = rule.ActionValue;
                    ticket.Version++;
                    ticket.UpdatedAt = now;
                    return JsonSerializer.Serialize(new
                    {
                        action = "escalate_manager_chain",
                        team = rule.ActionValue,
                        level = ticketSla.EscalationLevel
                    });
                }
                return JsonSerializer.Serialize(new
                {
                    action = "escalate_manager_chain",
                    applied = false
                });

            default:
                return JsonSerializer.Serialize(new
                {
                    action = rule.ActionType,
                    applied = false
                });
        }
    }

    private static IReadOnlyList<EscalationLevelSpec> ParseEscalationLevels(
        string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<EscalationLevelSpec>>(
                json,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private sealed record EscalationLevelSpec(
        int Level,
        int Percent,
        string TargetType,
        string TargetId,
        string? ReassignTeam);
}
