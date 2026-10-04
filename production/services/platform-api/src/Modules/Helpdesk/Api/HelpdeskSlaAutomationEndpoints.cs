using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Helpdesk.Domain;
using INNO.One.Modules.Helpdesk.Infrastructure;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Api;

public static class HelpdeskSlaAutomationEndpoints
{
    public static RouteGroupBuilder MapHelpdeskSlaAutomationEndpoints(
        this RouteGroupBuilder api)
    {
        api.MapGet("/helpdesk/sla-policies", ListSlaPoliciesAsync)
            .WithName("helpdesk.sla_policies.list");

        api.MapPut("/helpdesk/sla-policies/{policyId}", UpdateSlaPolicyAsync)
            .WithName("helpdesk.sla_policies.update");

        api.MapGet("/helpdesk/sla-monitor", GetSlaMonitorAsync)
            .WithName("helpdesk.sla_monitor.get");

        api.MapGet("/helpdesk/business-calendar", GetBusinessCalendarAsync)
            .WithName("helpdesk.calendar.get");

        api.MapPut("/helpdesk/business-calendar", UpdateBusinessCalendarAsync)
            .WithName("helpdesk.calendar.update");

        // Step 45F retires the legacy simple-rule HTTP surface.
        // The table/entities remain migration inputs only; Product authoring now uses
        // the module-owned /helpdesk/automations facade in Automation Core.

        return api;
    }

    private static async Task<IResult> ListSlaPoliciesAsync(
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var policies = await db.SlaPolicies.AsNoTracking()
            .OrderBy(x => x.Priority)
            .ThenBy(x => x.Code)
            .ToListAsync(cancellationToken);
        var calendarIds = policies
            .Where(x => x.BusinessCalendarId.HasValue)
            .Select(x => x.BusinessCalendarId!.Value)
            .Distinct()
            .ToArray();
        var calendars = await db.BusinessCalendars.AsNoTracking()
            .Where(x => calendarIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        return Results.Ok(new
        {
            items = policies.Select(policy => ToPolicyResponse(
                policy,
                policy.BusinessCalendarId is Guid calendarId
                    ? calendars.GetValueOrDefault(calendarId)
                    : null))
        });
    }

    private static async Task<IResult> UpdateSlaPolicyAsync(
        string policyId,
        UpdateSlaPolicyRequest request,
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        HelpdeskLedgerWriter ledger,
        BusinessTimeCalculator businessTime,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(policyId, "sla", out var id))
        {
            return NotFound("SLA policy not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.sla.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var policy = await db.SlaPolicies
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (policy is null)
        {
            return NotFound("SLA policy not found.");
        }

        var concurrency = ValidateIfMatch(httpContext, policy.Version);
        if (concurrency is not null)
        {
            return concurrency;
        }

        if (request.ResponseMinutes is < 1 or > 43_200)
        {
            return Validation("responseMinutes", "Response target must be between 1 minute and 30 days.");
        }
        if (request.ResolutionMinutes is < 1 or > 43_200)
        {
            return Validation("resolutionMinutes", "Resolution target must be between 1 minute and 30 days.");
        }
        if (request.ResolutionMinutes < request.ResponseMinutes)
        {
            return Validation("resolutionMinutes", "Resolution target cannot be shorter than response target.");
        }

        Guid? calendarId = policy.BusinessCalendarId;
        if (!string.IsNullOrWhiteSpace(request.BusinessCalendarId))
        {
            if (!OpaqueId.TryParse(
                    request.BusinessCalendarId,
                    "cal",
                    out var parsedCalendarId)
                || !await db.BusinessCalendars.AsNoTracking().AnyAsync(
                    x => x.Id == parsedCalendarId && x.IsActive,
                    cancellationToken))
            {
                return Validation("businessCalendarId", "Select an active Business Calendar.");
            }

            calendarId = parsedCalendarId;
        }

        var levels = NormalizeEscalationLevels(request.EscalationLevels);
        if (levels is null)
        {
            return Validation(
                "escalationLevels",
                "Escalation levels must use unique positive levels and 1–100 percent thresholds.");
        }

        var before = new
        {
            policy.ResponseMinutes,
            policy.ResolutionMinutes,
            policy.BusinessCalendarId,
            policy.AppliesTo,
            policy.PauseOnRequesterWait,
            policy.NotifyRequesterOnStatusChange,
            policy.ReassignOnBreach,
            policy.IsActive
        };

        policy.ResponseMinutes = request.ResponseMinutes;
        policy.ResolutionMinutes = request.ResolutionMinutes;
        policy.BusinessCalendarId = calendarId;
        policy.AppliesTo = NullIfWhiteSpace(request.AppliesTo)
            ?? policy.AppliesTo;
        policy.PauseOnRequesterWait = request.PauseOnRequesterWait;
        policy.NotifyRequesterOnStatusChange = request.NotifyRequesterOnStatusChange;
        policy.ReassignOnBreach = request.ReassignOnBreach;
        policy.EscalationLevelsJson = JsonSerializer.Serialize(levels);
        policy.IsActive = request.IsActive;
        policy.Version++;
        policy.UpdatedAt = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        await RecalculatePolicyTicketsAsync(
            db,
            businessTime,
            policy,
            cancellationToken);

        await ledger.AppendAuditAsync(
            "helpdesk.sla_policy.updated",
            "sla_policy",
            policyId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                before,
                after = new
                {
                    policy.ResponseMinutes,
                    policy.ResolutionMinutes,
                    businessCalendarId = policy.BusinessCalendarId.HasValue
                        ? OpaqueId.Format("cal", policy.BusinessCalendarId.Value)
                        : null,
                    policy.AppliesTo,
                    policy.PauseOnRequesterWait,
                    policy.NotifyRequesterOnStatusChange,
                    policy.ReassignOnBreach,
                    policy.IsActive
                }
            },
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        var calendar = policy.BusinessCalendarId is Guid selectedCalendarId
            ? await db.BusinessCalendars.AsNoTracking()
                .SingleOrDefaultAsync(
                    x => x.Id == selectedCalendarId,
                    cancellationToken)
            : null;

        httpContext.Response.Headers.ETag = Etag(policy.Version);
        return Results.Ok(new ResourceResponse<SlaPolicyResponse>(
            ToPolicyResponse(policy, calendar)));
    }

    private static async Task<IResult> GetSlaMonitorAsync(
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        BusinessTimeCalculator businessTime,
        int page = 1,
        int pageSize = 25,
        string? state = null,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var tickets = ApplyTicketScope(
            db.Tickets.AsNoTracking().Where(x => x.ResolvedAt == null),
            access);

        var rows = await (
            from ticket in tickets
            join sla in db.TicketSla.AsNoTracking()
                on ticket.Id equals sla.TicketId
            join policy in db.SlaPolicies.AsNoTracking()
                on sla.PolicyId equals policy.Id
            join status in db.Statuses.AsNoTracking()
                on ticket.StatusId equals status.Id
            select new
            {
                Ticket = ticket,
                Sla = sla,
                Policy = policy,
                Status = status
            })
            .ToListAsync(cancellationToken);

        var computed = new List<SlaMonitorItem>();
        var now = DateTimeOffset.UtcNow;
        foreach (var row in rows)
        {
            var elapsed = await businessTime.CountBusinessMinutesAsync(
                row.Ticket.CreatedAt,
                now,
                row.Policy.BusinessCalendarId,
                cancellationToken);
            elapsed = Math.Max(
                0,
                elapsed - (int)(row.Sla.AccumulatedPausedSeconds / 60L));

            var percent = row.Policy.ResolutionMinutes <= 0
                ? 100
                : Math.Max(
                    0,
                    (int)Math.Floor(
                        elapsed * 100d / row.Policy.ResolutionMinutes));

            var effectiveState = row.Sla.PausedAt.HasValue
                ? "paused"
                : percent >= 100
                    ? "breached"
                    : percent >= 75
                        ? "at_risk"
                        : "active";

            computed.Add(new SlaMonitorItem(
                OpaqueId.Format("ticket", row.Ticket.Id),
                row.Ticket.TicketNumber,
                row.Ticket.Subject,
                row.Ticket.Priority,
                row.Status.Code,
                effectiveState,
                percent,
                row.Sla.EscalationLevel,
                row.Sla.ResponseDueAt,
                row.Sla.ResolutionDueAt,
                row.Sla.PausedAt,
                OpaqueId.Format("sla", row.Policy.Id),
                row.Policy.Name));
        }

        if (!string.IsNullOrWhiteSpace(state)
            && !string.Equals(state, "all", StringComparison.OrdinalIgnoreCase))
        {
            computed = computed
                .Where(x => string.Equals(
                    x.State,
                    state,
                    StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var totalItems = computed.Count;
        var items = computed
            .OrderByDescending(x => StateRank(x.State))
            .ThenByDescending(x => x.ElapsedPercent)
            .ThenBy(x => x.ResolutionDueAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();
        var totalPages = totalItems == 0
            ? 0
            : (int)Math.Ceiling(totalItems / (double)pageSize);

        return Results.Ok(new PagedResponse<SlaMonitorItem>(
            items,
            page,
            pageSize,
            totalItems,
            totalPages));
    }

    private static async Task<IResult> GetBusinessCalendarAsync(
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var calendar = await db.BusinessCalendars.AsNoTracking()
            .Where(x => x.IsDefault && x.IsActive)
            .OrderBy(x => x.Code)
            .FirstOrDefaultAsync(cancellationToken);
        if (calendar is null)
        {
            return NotFound("Business Calendar not found.");
        }

        var entries = await db.BusinessCalendarEntries.AsNoTracking()
            .Where(x => x.CalendarId == calendar.Id)
            .OrderBy(x => x.EntryType)
            .ThenBy(x => x.DayOfWeek)
            .ThenBy(x => x.CalendarDate)
            .ToListAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(calendar.Version);
        return Results.Ok(new ResourceResponse<BusinessCalendarResponse>(
            ToCalendarResponse(calendar, entries)));
    }

    private static async Task<IResult> UpdateBusinessCalendarAsync(
        UpdateBusinessCalendarRequest request,
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        HelpdeskLedgerWriter ledger,
        BusinessTimeCalculator businessTime,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.sla.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var calendar = await db.BusinessCalendars
            .Where(x => x.IsDefault && x.IsActive)
            .OrderBy(x => x.Code)
            .FirstOrDefaultAsync(cancellationToken);
        if (calendar is null)
        {
            return NotFound("Business Calendar not found.");
        }

        var concurrency = ValidateIfMatch(httpContext, calendar.Version);
        if (concurrency is not null)
        {
            return concurrency;
        }

        if (string.IsNullOrWhiteSpace(request.TimeZoneId))
        {
            return Validation("timeZoneId", "Time zone is required.");
        }

        try
        {
            _ = TimeZoneInfo.FindSystemTimeZoneById(request.TimeZoneId.Trim());
        }
        catch (TimeZoneNotFoundException)
        {
            return Validation("timeZoneId", "Unknown time zone.");
        }

        var workingDays = request.WorkingDays
            .GroupBy(x => x.DayOfWeek)
            .Select(x => x.Last())
            .OrderBy(x => x.DayOfWeek)
            .ToArray();
        if (workingDays.Any(x =>
            x.DayOfWeek is < 0 or > 6
            || x.StartMinute is < 0 or > 1439
            || x.EndMinute is < 1 or > 1440
            || x.EndMinute <= x.StartMinute))
        {
            return Validation(
                "workingDays",
                "Working-day windows must use day 0–6 and valid start/end minutes.");
        }

        var existingWeekly = await db.BusinessCalendarEntries
            .Where(x =>
                x.CalendarId == calendar.Id
                && x.EntryType == "weekly")
            .ToListAsync(cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.BusinessCalendarEntries.RemoveRange(existingWeekly);

        foreach (var day in workingDays)
        {
            db.BusinessCalendarEntries.Add(new BusinessCalendarEntry
            {
                Id = Guid.NewGuid(),
                CalendarId = calendar.Id,
                EntryType = "weekly",
                DayOfWeek = day.DayOfWeek,
                StartMinute = day.StartMinute,
                EndMinute = day.EndMinute,
                IsWorking = day.IsWorking,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        }

        calendar.Name = NullIfWhiteSpace(request.Name) ?? calendar.Name;
        calendar.TimeZoneId = request.TimeZoneId.Trim();
        calendar.Version++;
        calendar.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var affectedPolicies = await db.SlaPolicies
            .Where(x => x.BusinessCalendarId == calendar.Id)
            .ToListAsync(cancellationToken);
        foreach (var policy in affectedPolicies)
        {
            await RecalculatePolicyTicketsAsync(
                db,
                businessTime,
                policy,
                cancellationToken);

            await ledger.AppendAuditAsync(
                "helpdesk.sla_policy.updated",
                "sla_policy",
                OpaqueId.Format("sla", policy.Id),
                OpaqueId.Format("user", access.UserId),
                CorrelationId(httpContext),
                httpContext.TraceIdentifier,
                new
                {
                    changeType = "business_calendar_updated",
                    businessCalendarId = OpaqueId.Format("cal", calendar.Id)
                },
                cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        var entries = await db.BusinessCalendarEntries.AsNoTracking()
            .Where(x => x.CalendarId == calendar.Id)
            .OrderBy(x => x.EntryType)
            .ThenBy(x => x.DayOfWeek)
            .ThenBy(x => x.CalendarDate)
            .ToListAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(calendar.Version);
        return Results.Ok(new ResourceResponse<BusinessCalendarResponse>(
            ToCalendarResponse(calendar, entries)));
    }

    private static async Task<IResult> ListAutomationRulesAsync(
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        int page = 1,
        int pageSize = 25,
        string? search = null,
        string? status = null,
        string? type = null,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.automation.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        IQueryable<AutomationRule> query = db.AutomationRules.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.Name.ToLower().Contains(term)
                || x.Trigger.ToLower().Contains(term)
                || x.ActionType.ToLower().Contains(term)
                || x.ActionValue.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == normalized);
        }

        if (!string.IsNullOrWhiteSpace(type)
            && !string.Equals(type, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = type.Trim().ToLowerInvariant();
            query = query.Where(x => x.RuleType.ToLower() == normalized);
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var ruleIds = rows.Select(x => x.Id).ToArray();
        var executionCounts = await db.AutomationExecutions.AsNoTracking()
            .Where(x => ruleIds.Contains(x.RuleId))
            .GroupBy(x => x.RuleId)
            .Select(x => new
            {
                RuleId = x.Key,
                Count = x.Count(),
                Last = x.Max(y => y.ExecutedAt)
            })
            .ToDictionaryAsync(x => x.RuleId, cancellationToken);

        var items = rows.Select(rule =>
        {
            executionCounts.TryGetValue(rule.Id, out var stats);
            return new AutomationRuleListItem(
                OpaqueId.Format("auto", rule.Id),
                rule.Name,
                rule.RuleType,
                rule.Trigger,
                ActionLabel(rule.ActionType, rule.ActionValue),
                rule.Status,
                stats?.Count ?? 0,
                stats?.Last,
                Etag(rule.Version));
        }).ToList();

        var totalPages = totalItems == 0
            ? 0
            : (int)Math.Ceiling(totalItems / (double)pageSize);

        return Results.Ok(new PagedResponse<AutomationRuleListItem>(
            items,
            page,
            pageSize,
            totalItems,
            totalPages));
    }

    private static async Task<IResult> GetAutomationRuleAsync(
        string ruleId,
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(ruleId, "auto", out var id))
        {
            return NotFound("Automation rule not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.automation.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var rule = await db.AutomationRules.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (rule is null)
        {
            return NotFound("Automation rule not found.");
        }

        var recent = await db.AutomationExecutions.AsNoTracking()
            .Where(x => x.RuleId == id)
            .OrderByDescending(x => x.ExecutedAt)
            .Take(10)
            .Select(x => new AutomationExecutionResponse(
                OpaqueId.Format("exec", x.Id),
                OpaqueId.Format("ticket", x.TicketId),
                x.Trigger,
                x.Result,
                x.ExecutedAt))
            .ToListAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(rule.Version);
        return Results.Ok(new ResourceResponse<AutomationRuleDetailResponse>(
            ToAutomationDetail(rule, recent)));
    }

    private static async Task<IResult> CreateAutomationRuleAsync(
        UpsertAutomationRuleRequest request,
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        HelpdeskLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.automation.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var validation = ValidateAutomationRule(request);
        if (validation is not null)
        {
            return validation;
        }

        var now = DateTimeOffset.UtcNow;
        var code = Slug(request.Name);
        if (await db.AutomationRules.AnyAsync(
            x => x.Code == code,
            cancellationToken))
        {
            code += "-" + Guid.NewGuid().ToString("N")[..6];
        }

        var rule = new AutomationRule
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            RuleType = NormalizeRuleType(request.RuleType),
            Trigger = NormalizeTrigger(request.Trigger),
            ScopeType = NormalizeScopeType(request.ScopeType),
            ScopeValue = NullIfWhiteSpace(request.ScopeValue),
            ConditionField = NormalizeConditionField(request.ConditionField),
            ConditionOperator = NormalizeConditionOperator(request.ConditionOperator),
            ConditionValue = request.ConditionValue.Trim(),
            ActionType = NormalizeActionType(request.ActionType),
            ActionValue = request.ActionValue.Trim(),
            Status = NormalizeRuleStatus(request.Status),
            SortOrder = request.SortOrder ?? 100,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.AutomationRules.Add(rule);
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("auto", rule.Id);
        await ledger.AppendAuditAsync(
            "helpdesk.automation_rule.updated",
            "automation_rule",
            publicId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                changeType = "created",
                rule.RuleType,
                rule.Trigger,
                rule.ActionType,
                rule.Status
            },
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(rule.Version);
        return Results.Created(
            $"/api/v1/helpdesk/automation-rules/{publicId}",
            new ResourceResponse<AutomationRuleDetailResponse>(
                ToAutomationDetail(rule, Array.Empty<AutomationExecutionResponse>())));
    }

    private static async Task<IResult> UpdateAutomationRuleAsync(
        string ruleId,
        UpsertAutomationRuleRequest request,
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        HelpdeskLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(ruleId, "auto", out var id))
        {
            return NotFound("Automation rule not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.automation.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var validation = ValidateAutomationRule(request);
        if (validation is not null)
        {
            return validation;
        }

        var rule = await db.AutomationRules
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (rule is null)
        {
            return NotFound("Automation rule not found.");
        }

        var concurrency = ValidateIfMatch(httpContext, rule.Version);
        if (concurrency is not null)
        {
            return concurrency;
        }

        var before = new
        {
            rule.Name,
            rule.RuleType,
            rule.Trigger,
            rule.ScopeType,
            rule.ScopeValue,
            rule.ConditionField,
            rule.ConditionOperator,
            rule.ConditionValue,
            rule.ActionType,
            rule.ActionValue,
            rule.Status
        };

        rule.Name = request.Name.Trim();
        rule.RuleType = NormalizeRuleType(request.RuleType);
        rule.Trigger = NormalizeTrigger(request.Trigger);
        rule.ScopeType = NormalizeScopeType(request.ScopeType);
        rule.ScopeValue = NullIfWhiteSpace(request.ScopeValue);
        rule.ConditionField = NormalizeConditionField(request.ConditionField);
        rule.ConditionOperator = NormalizeConditionOperator(request.ConditionOperator);
        rule.ConditionValue = request.ConditionValue.Trim();
        rule.ActionType = NormalizeActionType(request.ActionType);
        rule.ActionValue = request.ActionValue.Trim();
        rule.Status = NormalizeRuleStatus(request.Status);
        rule.SortOrder = request.SortOrder ?? rule.SortOrder;
        rule.Version++;
        rule.UpdatedAt = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        await ledger.AppendAuditAsync(
            "helpdesk.automation_rule.updated",
            "automation_rule",
            ruleId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                changeType = "updated",
                before,
                after = new
                {
                    rule.Name,
                    rule.RuleType,
                    rule.Trigger,
                    rule.ScopeType,
                    rule.ScopeValue,
                    rule.ConditionField,
                    rule.ConditionOperator,
                    rule.ConditionValue,
                    rule.ActionType,
                    rule.ActionValue,
                    rule.Status
                }
            },
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        var recent = await db.AutomationExecutions.AsNoTracking()
            .Where(x => x.RuleId == rule.Id)
            .OrderByDescending(x => x.ExecutedAt)
            .Take(10)
            .Select(x => new AutomationExecutionResponse(
                OpaqueId.Format("exec", x.Id),
                OpaqueId.Format("ticket", x.TicketId),
                x.Trigger,
                x.Result,
                x.ExecutedAt))
            .ToListAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(rule.Version);
        return Results.Ok(new ResourceResponse<AutomationRuleDetailResponse>(
            ToAutomationDetail(rule, recent)));
    }

    private static async Task RecalculatePolicyTicketsAsync(
        HelpdeskDbContext db,
        BusinessTimeCalculator businessTime,
        SlaPolicy policy,
        CancellationToken cancellationToken)
    {
        var ticketSlas = await db.TicketSla
            .Where(x => x.PolicyId == policy.Id && x.ResolvedAt == null)
            .ToListAsync(cancellationToken);
        if (ticketSlas.Count == 0)
        {
            return;
        }

        var ticketIds = ticketSlas.Select(x => x.TicketId).ToArray();
        var tickets = await db.Tickets.AsNoTracking()
            .Where(x => ticketIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var ticketSla in ticketSlas)
        {
            if (!tickets.TryGetValue(ticketSla.TicketId, out var ticket))
            {
                continue;
            }

            ticketSla.ResponseDueAt = await businessTime.AddBusinessMinutesAsync(
                ticket.CreatedAt,
                policy.ResponseMinutes,
                policy.BusinessCalendarId,
                cancellationToken);
            ticketSla.ResolutionDueAt = await businessTime.AddBusinessMinutesAsync(
                ticket.CreatedAt,
                policy.ResolutionMinutes,
                policy.BusinessCalendarId,
                cancellationToken);

            var pausedMinutes = (int)(ticketSla.AccumulatedPausedSeconds / 60L);
            if (pausedMinutes > 0)
            {
                ticketSla.ResponseDueAt = await businessTime.AddBusinessMinutesAsync(
                    ticketSla.ResponseDueAt,
                    pausedMinutes,
                    policy.BusinessCalendarId,
                    cancellationToken);
                ticketSla.ResolutionDueAt = await businessTime.AddBusinessMinutesAsync(
                    ticketSla.ResolutionDueAt,
                    pausedMinutes,
                    policy.BusinessCalendarId,
                    cancellationToken);
            }

            ticketSla.RiskEmittedAt = null;
            ticketSla.EscalationLevel = 0;
            ticketSla.State = ticketSla.PausedAt.HasValue ? "paused" : "active";
            ticketSla.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static SlaPolicyResponse ToPolicyResponse(
        SlaPolicy policy,
        BusinessCalendar? calendar)
    {
        var levels = DeserializeEscalationLevels(policy.EscalationLevelsJson);
        return new SlaPolicyResponse(
            OpaqueId.Format("sla", policy.Id),
            policy.Code,
            policy.Name,
            policy.Priority,
            policy.ResponseMinutes,
            policy.ResolutionMinutes,
            calendar is null
                ? null
                : new CalendarReferenceResponse(
                    OpaqueId.Format("cal", calendar.Id),
                    calendar.Name,
                    calendar.TimeZoneId),
            policy.AppliesTo,
            policy.PauseOnRequesterWait,
            policy.NotifyRequesterOnStatusChange,
            policy.ReassignOnBreach,
            levels,
            policy.IsActive,
            Etag(policy.Version));
    }

    private static BusinessCalendarResponse ToCalendarResponse(
        BusinessCalendar calendar,
        IReadOnlyCollection<BusinessCalendarEntry> entries) =>
        new(
            OpaqueId.Format("cal", calendar.Id),
            calendar.Code,
            calendar.Name,
            calendar.TimeZoneId,
            entries
                .Where(x => x.EntryType == "weekly")
                .OrderBy(x => x.DayOfWeek)
                .Select(x => new WorkingDayResponse(
                    x.DayOfWeek ?? 0,
                    x.StartMinute ?? 0,
                    x.EndMinute ?? 0,
                    x.IsWorking))
                .ToList(),
            entries
                .Where(x => x.EntryType == "holiday" && x.CalendarDate.HasValue)
                .OrderBy(x => x.CalendarDate)
                .Select(x => new HolidayResponse(
                    x.CalendarDate!.Value.ToString("yyyy-MM-dd"),
                    x.Name ?? "Holiday",
                    x.IsWorking))
                .ToList(),
            Etag(calendar.Version));

    private static AutomationRuleDetailResponse ToAutomationDetail(
        AutomationRule rule,
        IReadOnlyList<AutomationExecutionResponse> recent) =>
        new(
            OpaqueId.Format("auto", rule.Id),
            rule.Code,
            rule.Name,
            rule.RuleType,
            rule.Trigger,
            rule.ScopeType,
            rule.ScopeValue,
            rule.ConditionField,
            rule.ConditionOperator,
            rule.ConditionValue,
            rule.ActionType,
            rule.ActionValue,
            rule.Status,
            rule.SortOrder,
            recent,
            Etag(rule.Version));

    private static IReadOnlyList<EscalationLevelResponse> DeserializeEscalationLevels(
        string json)
    {
        try
        {
            var rows = JsonSerializer.Deserialize<List<EscalationLevelRequest>>(
                json,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? [];

            return rows
                .OrderBy(x => x.Level)
                .Select(x => new EscalationLevelResponse(
                    x.Level,
                    x.Percent,
                    x.TargetType,
                    x.TargetId,
                    x.ReassignTeam))
                .ToList();
        }
        catch (JsonException)
        {
            return Array.Empty<EscalationLevelResponse>();
        }
    }

    private static IReadOnlyList<EscalationLevelRequest>? NormalizeEscalationLevels(
        IReadOnlyList<EscalationLevelRequest>? levels)
    {
        var normalized = (levels ?? Array.Empty<EscalationLevelRequest>())
            .OrderBy(x => x.Level)
            .ToArray();

        if (normalized.Length == 0
            || normalized.Any(x =>
                x.Level <= 0
                || x.Percent is < 1 or > 100
                || string.IsNullOrWhiteSpace(x.TargetType)
                || string.IsNullOrWhiteSpace(x.TargetId))
            || normalized.Select(x => x.Level).Distinct().Count() != normalized.Length
            || normalized.Select(x => x.Percent).Distinct().Count() != normalized.Length)
        {
            return null;
        }

        return normalized;
    }

    private static IResult? ValidateAutomationRule(
        UpsertAutomationRuleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Validation("name", "Rule name is required.");
        }
        if (string.IsNullOrWhiteSpace(request.ConditionValue))
        {
            return Validation("conditionValue", "Condition value is required.");
        }
        if (string.IsNullOrWhiteSpace(request.ActionValue))
        {
            return Validation("actionValue", "Action value is required.");
        }

        var trigger = NormalizeTrigger(request.Trigger);
        if (trigger is not ("ticket_created" or "ticket_updated" or "sla_at_risk" or "status_changed"))
        {
            return Validation("trigger", "Unsupported automation trigger.");
        }

        var action = NormalizeActionType(request.ActionType);
        if (action is not ("assign_team" or "set_priority" or "escalate_manager_chain"))
        {
            return Validation("actionType", "Unsupported automation action.");
        }

        return null;
    }

    private static IQueryable<Ticket> ApplyTicketScope(
        IQueryable<Ticket> query,
        EffectiveAccess access)
    {
        if (access.AllResources)
        {
            return query;
        }

        var organizations = access.OrganizationIds.ToArray();
        var currentUserId = access.UserId;
        return query.Where(x =>
            x.RequesterUserId == currentUserId
            || x.AssigneeUserId == currentUserId
            || (x.RequesterOrganizationUnitId.HasValue
                && organizations.Contains(x.RequesterOrganizationUnitId.Value)));
    }

    private static int StateRank(string state) =>
        state switch
        {
            "breached" => 4,
            "at_risk" => 3,
            "paused" => 2,
            _ => 1
        };

    private static string NormalizeRuleType(string value) =>
        value.Trim().ToLowerInvariant() switch
        {
            "assignment" => "Assignment",
            "escalation" => "Escalation",
            "classification" => "Classification",
            "routing" => "Routing",
            _ => "Assignment"
        };

    private static string NormalizeTrigger(string value) =>
        Slug(value).Replace('-', '_');

    private static string NormalizeScopeType(string value) =>
        Slug(value).Replace('-', '_');

    private static string NormalizeConditionField(string value) =>
        Slug(value).Replace('-', '_');

    private static string NormalizeConditionOperator(string value) =>
        string.Equals(value.Trim(), "contains", StringComparison.OrdinalIgnoreCase)
            ? "contains"
            : "equals";

    private static string NormalizeActionType(string value) =>
        Slug(value).Replace('-', '_');

    private static string NormalizeRuleStatus(string value) =>
        string.Equals(value.Trim(), "paused", StringComparison.OrdinalIgnoreCase)
            ? "paused"
            : "active";

    private static string ActionLabel(
        string actionType,
        string actionValue) =>
        actionType switch
        {
            "assign_team" => "Assign team · " + actionValue,
            "set_priority" => "Set priority · " + actionValue,
            "escalate_manager_chain" => "Escalate · " + actionValue,
            _ => actionType + " · " + actionValue
        };

    private static string Slug(string value)
    {
        var slug = new string(value
            .Trim()
            .ToLowerInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-')
            .ToArray());
        while (slug.Contains("--", StringComparison.Ordinal))
        {
            slug = slug.Replace("--", "-", StringComparison.Ordinal);
        }
        return slug.Trim('-');
    }

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static IResult? ValidateIfMatch(
        HttpContext httpContext,
        long currentVersion)
    {
        var raw = httpContext.Request.Headers.IfMatch.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status428PreconditionRequired,
                title: "If-Match is required",
                detail: "Send the ETag returned by the resource.");
        }

        if (!TryReadVersion(raw, out var expectedVersion)
            || expectedVersion != currentVersion)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Resource changed",
                detail: "Refresh the resource and retry your update.");
        }

        return null;
    }

    private static bool TryReadVersion(
        string raw,
        out long version)
    {
        version = 0;
        var value = raw.Trim();
        if (value.StartsWith("W/\"", StringComparison.Ordinal)
            && value.EndsWith('"'))
        {
            value = value[3..^1];
        }
        else if (value.StartsWith('"')
            && value.EndsWith('"'))
        {
            value = value[1..^1];
        }

        return long.TryParse(value, out version);
    }

    private static string Etag(long version) => $"W/\"{version}\"";

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound(string detail) => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Resource not found",
        detail: detail);

    private static IResult Validation(
        string field,
        string detail) => Results.ValidationProblem(
        new Dictionary<string, string[]>
        {
            [field] = new[] { detail }
        },
        title: "Validation failed");

    public sealed record UpdateSlaPolicyRequest(
        int ResponseMinutes,
        int ResolutionMinutes,
        string? BusinessCalendarId,
        string? AppliesTo,
        bool PauseOnRequesterWait,
        bool NotifyRequesterOnStatusChange,
        bool ReassignOnBreach,
        IReadOnlyList<EscalationLevelRequest>? EscalationLevels,
        bool IsActive);

    public sealed record EscalationLevelRequest(
        int Level,
        int Percent,
        string TargetType,
        string TargetId,
        string? ReassignTeam);

    public sealed record UpdateBusinessCalendarRequest(
        string? Name,
        string TimeZoneId,
        IReadOnlyList<WorkingDayRequest> WorkingDays);

    public sealed record WorkingDayRequest(
        int DayOfWeek,
        int StartMinute,
        int EndMinute,
        bool IsWorking);

    public sealed record UpsertAutomationRuleRequest(
        string Name,
        string RuleType,
        string Trigger,
        string ScopeType,
        string? ScopeValue,
        string ConditionField,
        string ConditionOperator,
        string ConditionValue,
        string ActionType,
        string ActionValue,
        string Status,
        int? SortOrder);

    public sealed record CalendarReferenceResponse(
        string Id,
        string Name,
        string TimeZoneId);

    public sealed record EscalationLevelResponse(
        int Level,
        int Percent,
        string TargetType,
        string TargetId,
        string? ReassignTeam);

    public sealed record SlaPolicyResponse(
        string Id,
        string Code,
        string Name,
        string Priority,
        int ResponseMinutes,
        int ResolutionMinutes,
        CalendarReferenceResponse? BusinessCalendar,
        string? AppliesTo,
        bool PauseOnRequesterWait,
        bool NotifyRequesterOnStatusChange,
        bool ReassignOnBreach,
        IReadOnlyList<EscalationLevelResponse> EscalationLevels,
        bool IsActive,
        string ETag);

    public sealed record SlaMonitorItem(
        string TicketId,
        string TicketNumber,
        string Subject,
        string Priority,
        string Status,
        string State,
        int ElapsedPercent,
        int EscalationLevel,
        DateTimeOffset ResponseDueAt,
        DateTimeOffset ResolutionDueAt,
        DateTimeOffset? PausedAt,
        string PolicyId,
        string PolicyName);

    public sealed record WorkingDayResponse(
        int DayOfWeek,
        int StartMinute,
        int EndMinute,
        bool IsWorking);

    public sealed record HolidayResponse(
        string Date,
        string Name,
        bool IsWorking);

    public sealed record BusinessCalendarResponse(
        string Id,
        string Code,
        string Name,
        string TimeZoneId,
        IReadOnlyList<WorkingDayResponse> WorkingDays,
        IReadOnlyList<HolidayResponse> Holidays,
        string ETag);

    public sealed record AutomationRuleListItem(
        string Id,
        string Name,
        string RuleType,
        string Trigger,
        string PrimaryAction,
        string Status,
        int ExecutionCount,
        DateTimeOffset? LastExecutedAt,
        string ETag);

    public sealed record AutomationExecutionResponse(
        string Id,
        string TicketId,
        string Trigger,
        string Result,
        DateTimeOffset ExecutedAt);

    public sealed record AutomationRuleDetailResponse(
        string Id,
        string Code,
        string Name,
        string RuleType,
        string Trigger,
        string ScopeType,
        string? ScopeValue,
        string ConditionField,
        string ConditionOperator,
        string ConditionValue,
        string ActionType,
        string ActionValue,
        string Status,
        int SortOrder,
        IReadOnlyList<AutomationExecutionResponse> RecentExecutions,
        string ETag);
}
