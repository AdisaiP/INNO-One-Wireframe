namespace INNO.One.Contracts.Integrations;

/// <summary>
/// Boundary implemented by the MeshCentral adapter. INNO.One IDs stay canonical and
/// vendor identifiers never become public resource IDs.
/// </summary>
public interface IRemoteDeviceEngine
{
    bool IsEnabled { get; }

    Task<IReadOnlyList<RemoteDeviceGroup>> ListGroupsAsync(
        CancellationToken cancellationToken = default);

    Task<RemoteDeviceGroup> CreateGroupAsync(
        string name,
        string? description,
        CancellationToken cancellationToken = default);

    Task UpdateGroupAsync(
        string externalGroupId,
        string name,
        string? description,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RemoteDeviceNode>> ListNodesAsync(
        CancellationToken cancellationToken = default);

    Task<RemoteEnrollmentLink> CreateEnrollmentLinkAsync(
        string externalGroupId,
        int expiresHours,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RemoteProcessInfo>> ListProcessesAsync(
        string externalNodeId,
        CancellationToken cancellationToken = default);

    Task<bool> TerminateProcessAsync(
        string externalNodeId,
        int processId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RemoteServiceInfo>> ListServicesAsync(
        string externalNodeId,
        CancellationToken cancellationToken = default);

    Task<bool> ExecuteServiceActionAsync(
        string externalNodeId,
        string serviceName,
        RemoteServiceAction action,
        CancellationToken cancellationToken = default);

    Task<RemoteDesktopShare> CreateDesktopShareAsync(
        string externalNodeId,
        string guestName,
        int durationMinutes,
        bool viewOnly,
        CancellationToken cancellationToken = default);

    Task RemoveDesktopShareAsync(
        string externalNodeId,
        string externalShareId,
        CancellationToken cancellationToken = default);
}

public sealed record RemoteDeviceGroup(
    string ExternalId,
    string Name,
    string? Description);

public sealed record RemoteDeviceNode(
    string ExternalId,
    string ExternalGroupId,
    string Name,
    bool IsOnline,
    string? IpAddress,
    string? OperatingSystem,
    string? AgentVersion,
    int? Icon);

public sealed record RemoteEnrollmentLink(
    string Url,
    DateTimeOffset? ExpiresAt);

public sealed record RemoteDesktopShare(
    string ExternalShareId,
    string Url,
    DateTimeOffset ExpiresAt);

public sealed record RemoteProcessInfo(
    int ProcessId,
    string Name,
    string? User,
    string? CommandLine,
    decimal? CpuPercent,
    long? MemoryBytes);

public sealed record RemoteServiceInfo(
    string Name,
    string? DisplayName,
    string? Status,
    string? StartType,
    string? User);

public enum RemoteServiceAction
{
    Start,
    Stop,
    Restart
}

public sealed class RemoteEngineUnavailableException(string message, Exception? innerException = null)
    : Exception(message, innerException);
