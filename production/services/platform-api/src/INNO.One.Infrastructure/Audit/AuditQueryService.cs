using INNO.One.Contracts.Audit;
using INNO.One.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Infrastructure.Audit;

public sealed class AuditQueryService(InfrastructureDbContext db) : IAuditQueryService
{
    public async Task<AuditPageResult> QueryAsync(
        AuditQuery query,
        CancellationToken cancellationToken = default)
    {
        var page = Math.Max(query.Page, 1);
        var pageSize = Math.Clamp(query.PageSize <= 0 ? 50 : query.PageSize, 1, 100);

        var rows = db.AuditRecords.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            rows = rows.Where(x =>
                x.Action.ToLower().Contains(term)
                || x.Module.ToLower().Contains(term)
                || x.TargetType.ToLower().Contains(term)
                || x.TargetId.ToLower().Contains(term)
                || x.ActorId.ToLower().Contains(term)
                || (x.CorrelationId != null && x.CorrelationId.ToLower().Contains(term))
                || (x.TraceId != null && x.TraceId.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(query.Module) && query.Module != "all")
        {
            var value = query.Module.Trim();
            rows = rows.Where(x => x.Module == value);
        }

        if (!string.IsNullOrWhiteSpace(query.Action) && query.Action != "all")
        {
            var value = query.Action.Trim();
            rows = rows.Where(x => x.Action == value);
        }

        if (!string.IsNullOrWhiteSpace(query.Actor))
        {
            var value = query.Actor.Trim().ToLower();
            rows = rows.Where(x => x.ActorId.ToLower().Contains(value));
        }

        if (!string.IsNullOrWhiteSpace(query.TargetType) && query.TargetType != "all")
        {
            var value = query.TargetType.Trim();
            rows = rows.Where(x => x.TargetType == value);
        }

        if (!string.IsNullOrWhiteSpace(query.Classification) && query.Classification != "all")
        {
            var value = query.Classification.Trim();
            rows = rows.Where(x => x.Classification == value);
        }

        if (query.From.HasValue)
        {
            rows = rows.Where(x => x.OccurredAt >= query.From.Value);
        }

        if (query.To.HasValue)
        {
            rows = rows.Where(x => x.OccurredAt <= query.To.Value);
        }

        var total = await rows.CountAsync(cancellationToken);
        var pageRows = await rows
            .OrderByDescending(x => x.OccurredAt)
            .ThenByDescending(x => x.AuditId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AuditRecordSnapshot(
                x.AuditId,
                x.OccurredAt,
                x.Action,
                x.Module,
                x.TargetType,
                x.TargetId,
                x.ActorType,
                x.ActorId,
                x.CorrelationId,
                x.TraceId,
                x.Classification,
                x.MetadataJson))
            .ToArrayAsync(cancellationToken);

        return new AuditPageResult(
            pageRows,
            page,
            pageSize,
            total,
            (int)Math.Ceiling(total / (double)pageSize));
    }

    public Task<AuditRecordSnapshot?> GetAsync(
        Guid auditId,
        CancellationToken cancellationToken = default) =>
        db.AuditRecords.AsNoTracking()
            .Where(x => x.AuditId == auditId)
            .Select(x => new AuditRecordSnapshot(
                x.AuditId,
                x.OccurredAt,
                x.Action,
                x.Module,
                x.TargetType,
                x.TargetId,
                x.ActorType,
                x.ActorId,
                x.CorrelationId,
                x.TraceId,
                x.Classification,
                x.MetadataJson))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<AuditFacets> GetFacetsAsync(
        CancellationToken cancellationToken = default)
    {
        var modules = await db.AuditRecords.AsNoTracking()
            .Select(x => x.Module)
            .Distinct()
            .OrderBy(x => x)
            .Take(100)
            .ToArrayAsync(cancellationToken);

        var actions = await db.AuditRecords.AsNoTracking()
            .Select(x => x.Action)
            .Distinct()
            .OrderBy(x => x)
            .Take(500)
            .ToArrayAsync(cancellationToken);

        var targetTypes = await db.AuditRecords.AsNoTracking()
            .Select(x => x.TargetType)
            .Distinct()
            .OrderBy(x => x)
            .Take(200)
            .ToArrayAsync(cancellationToken);

        var classifications = await db.AuditRecords.AsNoTracking()
            .Select(x => x.Classification)
            .Distinct()
            .OrderBy(x => x)
            .Take(50)
            .ToArrayAsync(cancellationToken);

        return new AuditFacets(
            modules,
            actions,
            targetTypes,
            classifications);
    }
}
