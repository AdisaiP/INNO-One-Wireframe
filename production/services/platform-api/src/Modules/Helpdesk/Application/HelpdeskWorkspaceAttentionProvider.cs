using System.Security.Claims;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Workspace;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Application;

public sealed class HelpdeskWorkspaceAttentionProvider(
    HelpdeskDbContext db,
    IAccessEvaluator accessEvaluator) : IWorkspaceAttentionProvider, IWorkspaceResourceVisibilityProvider
{
    public string ProviderId => "helpdesk";

    public async Task<IReadOnlyList<WorkspaceAttentionItem>> GetAttentionAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "helpdesk.ticket.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Array.Empty<WorkspaceAttentionItem>();
        }
        var assigned = await (
            from ticket in db.Tickets.AsNoTracking()
            join status in db.Statuses.AsNoTracking()
                on ticket.StatusId equals status.Id
            where ticket.AssigneeUserId == access.UserId
                && !status.IsClosed
            select ticket.Id)
            .ToArrayAsync(cancellationToken);

        if (assigned.Length == 0)
        {
            return Array.Empty<WorkspaceAttentionItem>();
        }

        var now = DateTimeOffset.UtcNow;
        var atRisk = await db.TicketSla.AsNoTracking()
            .CountAsync(sla =>
                assigned.Contains(sla.TicketId)
                && sla.ResolvedAt == null
                && sla.ResolutionDueAt <= now.AddMinutes(90),
                cancellationToken);
        var detail = atRisk > 0
            ? $"{atRisk} approaching or beyond the SLA target"
            : "Open tickets currently assigned to you";

        return
        [
            new WorkspaceAttentionItem(
                "helpdesk.assigned",
                "helpdesk",
                assigned.Length == 1
                    ? "1 ticket assigned to you"
                    : $"{assigned.Length} tickets assigned to you",
                detail,
                assigned.Length,
                atRisk > 0 ? "danger" : "warning",
                "/helpdesk/assigned")
        ];
    }

    public async Task<bool> CanAccessAsync(
        ClaimsPrincipal principal,
        string resourceType,
        string resourceId,
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(resourceType, "ticket", StringComparison.Ordinal)
            || !OpaqueId.TryParse(resourceId, "ticket", out var id))
        {
            return false;
        }

        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "helpdesk.ticket.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return false;
        }

        var ticket = await db.Tickets.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (ticket is null)
        {
            return false;
        }

        return access.AllResources
            || ticket.RequesterUserId == access.UserId
            || ticket.AssigneeUserId == access.UserId
            || (ticket.RequesterOrganizationUnitId is Guid organizationId
                && access.OrganizationIds.Contains(organizationId));
    }
}
