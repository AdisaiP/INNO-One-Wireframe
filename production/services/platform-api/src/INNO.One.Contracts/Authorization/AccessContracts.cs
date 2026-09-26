using System.Security.Claims;

namespace INNO.One.Contracts.Authorization;

public sealed record EffectiveAccess(
    bool Allowed,
    Guid UserId,
    string Permission,
    bool AllResources,
    IReadOnlySet<Guid> OrganizationIds,
    IReadOnlySet<Guid> LocationIds,
    IReadOnlySet<Guid> DeviceGroupIds,
    IReadOnlyList<Guid> MatchedAssignmentIds,
    string Reason);

public interface IAccessEvaluator
{
    Task<EffectiveAccess> EvaluateAsync(
        ClaimsPrincipal principal,
        string permission,
        CancellationToken cancellationToken = default);
}
