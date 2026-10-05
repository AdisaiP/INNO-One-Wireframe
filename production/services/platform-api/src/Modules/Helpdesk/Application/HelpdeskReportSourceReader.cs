using System.Security.Claims;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Reports;
using INNO.One.Modules.Helpdesk.Domain;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Application;

public sealed class HelpdeskReportSourceReader(
    HelpdeskDbContext db,
    IAccessEvaluator accessEvaluator,
    IPlatformDirectoryReader directoryReader) : IReportSourceReader
{
    private static readonly ReportSourceColumn[] Columns =
    [
        new("ticketNumber", "Ticket", "text"),
        new("subject", "Subject", "text"),
        new("status", "Status", "text"),
        new("priority", "Priority", "text"),
        new("requester", "Requester", "text"),
        new("organization", "Organization", "text"),
        new("assignee", "Assignee", "text"),
        new("team", "Team", "text"),
        new("createdAt", "Created", "datetime"),
        new("updatedAt", "Updated", "datetime"),
        new("resolvedAt", "Resolved", "datetime")
    ];

    public ReportSourceDescriptor Descriptor { get; } = new(
        "helpdesk.tickets",
        "Helpdesk Tickets",
        "helpdesk.ticket.view",
        Columns,
        ["status", "priority", "organization", "team"]);

    public async Task<ReportTabularResult> ReadAsync(
        ClaimsPrincipal principal,
        IReadOnlyList<string> columns,
        IReadOnlyList<ReportFilter> filters,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            Descriptor.RequiredPermission,
            cancellationToken);
        if (!access.Allowed)
        {
            throw new ReportSourceAccessException(
                "REPORT_SOURCE_PERMISSION_DENIED",
                access.Reason);
        }

        var tickets = await db.Tickets.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        var visible = tickets
            .Where(x => CanAccess(access, x))
            .ToArray();

        var statusIds = visible.Select(x => x.StatusId).Distinct().ToArray();
        var statuses = await db.Statuses.AsNoTracking()
            .Where(x => statusIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var userIds = visible
            .SelectMany(x => new[] { x.RequesterUserId, x.AssigneeUserId ?? Guid.Empty })
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToArray();
        var organizationIds = visible
            .Where(x => x.RequesterOrganizationUnitId.HasValue)
            .Select(x => x.RequesterOrganizationUnitId!.Value)
            .Distinct()
            .ToArray();
        var directory = await directoryReader.ReadAsync(
            userIds,
            organizationIds,
            Array.Empty<Guid>(),
            cancellationToken);

        var requested = NormalizeColumns(columns);
        var rows = visible
            .Select(x => CreateRow(x, statuses, directory))
            .Where(row => Matches(row, filters))
            .Select(row => requested.ToDictionary(
                key => key,
                key => row.GetValueOrDefault(key),
                StringComparer.OrdinalIgnoreCase))
            .Cast<IReadOnlyDictionary<string, string?>>()
            .ToArray();

        return new ReportTabularResult(requested, rows);
    }

    private static bool CanAccess(EffectiveAccess access, Ticket ticket) =>
        access.AllResources
        || ticket.RequesterUserId == access.UserId
        || ticket.AssigneeUserId == access.UserId
        || (ticket.RequesterOrganizationUnitId is Guid organizationId
            && access.OrganizationIds.Contains(organizationId));

    private static Dictionary<string, string?> CreateRow(
        Ticket ticket,
        IReadOnlyDictionary<Guid, string> statuses,
        PlatformDirectorySnapshot directory) =>
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["ticketNumber"] = ticket.TicketNumber,
            ["subject"] = ticket.Subject,
            ["status"] = statuses.GetValueOrDefault(ticket.StatusId),
            ["priority"] = ticket.Priority,
            ["requester"] = directory.Users.GetValueOrDefault(ticket.RequesterUserId),
            ["organization"] = ticket.RequesterOrganizationUnitId is Guid organizationId
                ? directory.Organizations.GetValueOrDefault(organizationId)
                : null,
            ["assignee"] = ticket.AssigneeUserId is Guid assigneeId
                ? directory.Users.GetValueOrDefault(assigneeId)
                : null,
            ["team"] = ticket.AssigneeTeam,
            ["createdAt"] = ticket.CreatedAt.ToUniversalTime().ToString("O"),
            ["updatedAt"] = ticket.UpdatedAt.ToUniversalTime().ToString("O"),
            ["resolvedAt"] = ticket.ResolvedAt?.ToUniversalTime().ToString("O")
        };

    private static string[] NormalizeColumns(IReadOnlyList<string> columns)
    {
        var allowed = Columns.Select(x => x.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var selected = columns.Where(allowed.Contains).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        return selected.Length > 0 ? selected : Columns.Select(x => x.Key).ToArray();
    }

    private static bool Matches(
        IReadOnlyDictionary<string, string?> row,
        IReadOnlyList<ReportFilter> filters) =>
        filters.All(filter =>
        {
            if (!row.TryGetValue(filter.Field, out var value))
            {
                return false;
            }
            var left = value ?? "";
            var right = filter.Value ?? "";
            return filter.Operator.Trim().ToLowerInvariant() switch
            {
                "contains" => left.Contains(right, StringComparison.OrdinalIgnoreCase),
                "not_equals" => !string.Equals(left, right, StringComparison.OrdinalIgnoreCase),
                _ => string.Equals(left, right, StringComparison.OrdinalIgnoreCase)
            };
        });
}
