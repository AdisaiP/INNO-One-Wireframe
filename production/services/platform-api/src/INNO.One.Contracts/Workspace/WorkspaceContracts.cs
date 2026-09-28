using System.Security.Claims;

namespace INNO.One.Contracts.Workspace;

public sealed record WorkspaceAttentionItem(
    string Id,
    string Module,
    string Title,
    string Detail,
    int Count,
    string Severity,
    string Route);

public interface IWorkspaceAttentionProvider
{
    string ProviderId { get; }

    Task<IReadOnlyList<WorkspaceAttentionItem>> GetAttentionAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken = default);
}

public interface IWorkspaceResourceVisibilityProvider
{
    string ProviderId { get; }

    Task<bool> CanAccessAsync(
        ClaimsPrincipal principal,
        string resourceType,
        string resourceId,
        CancellationToken cancellationToken = default);
}
