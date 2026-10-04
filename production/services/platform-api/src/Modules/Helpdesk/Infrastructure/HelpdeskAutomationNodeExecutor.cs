using System.Security.Claims;
using System.Text.Json;
using INNO.One.Contracts.Automation;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Helpdesk.Domain;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Infrastructure;

public sealed class HelpdeskAutomationNodeExecutor(
    HelpdeskDbContext db,
    IAccessEvaluator accessEvaluator,
    HelpdeskLedgerWriter ledger) : IAutomationNodeExecutor
{
    public string OwnerModule => "helpdesk";

    public bool Supports(string catalogKey) =>
        catalogKey is "helpdesk.ticket.assign_team"
            or "helpdesk.ticket.escalate";

    public AutomationNodeValidationResult Validate(
        string catalogKey,
        JsonElement configuration)
    {
        if (!Supports(catalogKey))
        {
            return AutomationNodeValidationResult.Failure(
                "AUTOMATION_NODE_NOT_EXECUTABLE",
                "Helpdesk does not support execution for '" + catalogKey + "'.");
        }

        return TryTeam(configuration, out _)
            ? AutomationNodeValidationResult.Success()
            : AutomationNodeValidationResult.Failure(
                "HELPDESK_TEAM_REQUIRED",
                "Assign Team and Escalate Ticket nodes require a support team.");
    }

    public async Task<AutomationNodeExecutionResult> ExecuteAsync(
        AutomationNodeExecutionContext context,
        CancellationToken cancellationToken = default)
    {
        if (!Supports(context.CatalogKey))
        {
            return AutomationNodeExecutionResult.Failure(
                "AUTOMATION_NODE_NOT_EXECUTABLE",
                "Helpdesk does not support execution for '" + context.CatalogKey + "'.");
        }

        if (!TryString(context.Input, "ticketId", out var ticketId)
            || !OpaqueId.TryParse(ticketId, "ticket", out var ticketGuid))
        {
            return AutomationNodeExecutionResult.Failure(
                "HELPDESK_TICKET_CONTEXT_REQUIRED",
                "A valid Helpdesk ticket context is required.");
        }

        if (!TryTeam(context.Configuration, out var team))
        {
            return AutomationNodeExecutionResult.Failure(
                "HELPDESK_TEAM_REQUIRED",
                "Assign Team and Escalate Ticket nodes require a support team.");
        }

        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("sub", context.ActorSubject) },
            "automation-worker"));

        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "helpdesk.ticket.assign",
            cancellationToken);
        if (!access.Allowed || access.UserId != context.ActorUserId)
        {
            return AutomationNodeExecutionResult.Failure(
                "HELPDESK_ASSIGN_PERMISSION_DENIED",
                "The automation actor does not currently have ticket assignment permission.");
        }

        var ticket = await db.Tickets.SingleOrDefaultAsync(
            x => x.Id == ticketGuid,
            cancellationToken);
        if (ticket is null)
        {
            return AutomationNodeExecutionResult.Failure(
                "HELPDESK_TICKET_NOT_FOUND",
                "The ticket is unavailable.");
        }

        if (!CanAccessTicket(access, ticket))
        {
            return AutomationNodeExecutionResult.Failure(
                "HELPDESK_TICKET_SCOPE_DENIED",
                "The automation actor cannot access this ticket.");
        }

        var runId = OpaqueId.Format("run", context.RunId);
        var marker = "Automation " + runId + " node " + context.NodeId;

        var existing = await db.TicketAssignments.AsNoTracking()
            .Where(x => x.TicketId == ticket.Id && x.Note == marker)
            .OrderByDescending(x => x.AssignedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is not null)
        {
            return AutomationNodeExecutionResult.Success(JsonSerializer.SerializeToElement(new
            {
                ticketId,
                team = existing.Team,
                assignedAt = existing.AssignedAt,
                idempotentReplay = true
            }));
        }

        var previousAssigneeId = ticket.AssigneeUserId;
        var now = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            ticket.AssigneeUserId = null;
            ticket.AssigneeTeam = team;
            ticket.Version++;
            ticket.UpdatedAt = now;

            db.TicketAssignments.Add(new TicketAssignment
            {
                Id = Guid.NewGuid(),
                TicketId = ticket.Id,
                PreviousAssigneeUserId = previousAssigneeId,
                AssigneeUserId = null,
                Team = team,
                AssignedByUserId = access.UserId,
                Note = marker,
                AssignedAt = now
            });

            await db.SaveChangesAsync(cancellationToken);

            var actorId = OpaqueId.Format("user", access.UserId);
            await ledger.AppendAuditAsync(
                context.CatalogKey == "helpdesk.ticket.escalate"
                    ? "helpdesk.ticket.automation_escalated"
                    : "helpdesk.ticket.automation_assigned",
                "ticket",
                ticketId,
                actorId,
                context.CorrelationId,
                context.TraceId,
                new
                {
                    automationRunId = runId,
                    workflowId = OpaqueId.Format("wf", context.WorkflowId),
                    workflowVersion = context.WorkflowVersion,
                    nodeId = context.NodeId,
                    team
                },
                cancellationToken);

            await ledger.AppendOutboxAsync(
                "ticket.assigned",
                "ticket",
                ticketId,
                new
                {
                    ticketId,
                    teamId = TeamId(team),
                    assigneeUserId = (string?)null,
                    assignedByUserId = actorId,
                    automationRunId = runId
                },
                context.CorrelationId,
                runId,
                context.TraceId,
                cancellationToken);

            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AutomationNodeExecutionResult.Failure(
                "HELPDESK_TICKET_CHANGED",
                "The ticket changed while the automation was assigning it.",
                retryable: true);
        }
        catch (DbUpdateException)
        {
            return AutomationNodeExecutionResult.Failure(
                "HELPDESK_ASSIGNMENT_WRITE_FAILED",
                "The ticket assignment could not be persisted.",
                retryable: true);
        }

        return AutomationNodeExecutionResult.Success(JsonSerializer.SerializeToElement(new
        {
            ticketId,
            team,
            assignedAt = now,
            ticketVersion = ticket.Version,
            idempotentReplay = false
        }));
    }

    private static bool CanAccessTicket(EffectiveAccess access, Ticket ticket) =>
        access.AllResources
        || ticket.RequesterUserId == access.UserId
        || ticket.AssigneeUserId == access.UserId
        || (ticket.RequesterOrganizationUnitId is Guid organizationId
            && access.OrganizationIds.Contains(organizationId));

    private static bool TryTeam(JsonElement configuration, out string team)
    {
        if (TryString(configuration, "team", out team)
            || TryString(configuration, "actionValue", out team))
        {
            if (team.Length <= 120)
            {
                return true;
            }
        }

        team = "";
        return false;
    }

    private static bool TryString(JsonElement element, string property, out string value)
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

    private static string TeamId(string? team)
    {
        if (string.IsNullOrWhiteSpace(team))
        {
            return "team_unassigned";
        }

        var normalized = new string(
            team.Trim().ToLowerInvariant()
                .Select(ch => char.IsLetterOrDigit(ch) ? ch : '_')
                .ToArray());
        return "team_" + normalized.Trim('_');
    }
}
