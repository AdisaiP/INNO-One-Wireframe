using System.Security.Claims;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Search;
using INNO.One.Modules.Helpdesk.Domain;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Application;

public sealed class HelpdeskGlobalSearchProvider(
    HelpdeskDbContext db,
    IAccessEvaluator accessEvaluator) : IGlobalSearchProvider
{
    public string ProviderId => "helpdesk";

    public async Task<IReadOnlyList<GlobalSearchResult>> SearchAsync(
        ClaimsPrincipal principal,
        string query,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "helpdesk.ticket.view",
            cancellationToken);

        if (!access.Allowed)
        {
            return Array.Empty<GlobalSearchResult>();
        }

        IQueryable<Ticket> search = db.Tickets.AsNoTracking();
        if (!access.AllResources)
        {
            var organizations = access.OrganizationIds.ToArray();
            var currentUserId = access.UserId;
            search = search.Where(ticket =>
                ticket.RequesterUserId == currentUserId
                || ticket.AssigneeUserId == currentUserId
                || (ticket.RequesterOrganizationUnitId.HasValue
                    && organizations.Contains(ticket.RequesterOrganizationUnitId.Value)));
        }

        var term = query.Trim().ToLowerInvariant();
        var rows = await search
            .Where(ticket =>
                ticket.TicketNumber.ToLower().Contains(term)
                || ticket.Subject.ToLower().Contains(term))
            .OrderByDescending(ticket => ticket.UpdatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return rows.Select(ticket => new GlobalSearchResult(
            "ticket",
            OpaqueId.Format("ticket", ticket.Id),
            ticket.TicketNumber + " · " + ticket.Subject,
            string.Join(
                " · ",
                new[] { "Helpdesk", ticket.Priority, ticket.AssigneeTeam }
                    .Where(value => !string.IsNullOrWhiteSpace(value))),
            "/helpdesk/tickets/" + OpaqueId.Format("ticket", ticket.Id)))
            .ToArray();
    }
}
