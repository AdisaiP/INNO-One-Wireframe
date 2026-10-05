namespace INNO.One.Modules.Devices.Domain;

public sealed class Device
{
    public Guid Id { get; set; }
    public required string Hostname { get; set; }
    public required string DeviceType { get; set; }
    public required string ConnectivityState { get; set; }
    public Guid? OwnerUserId { get; set; }
    public Guid? OrganizationUnitId { get; set; }
    public Guid? LocationId { get; set; }
    public string? SerialNumber { get; set; }
    public string? IpAddress { get; set; }
    public string? MacAddress { get; set; }
    public string? OperatingSystem { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? Processor { get; set; }
    public string? BiosVersion { get; set; }
    public string? LoggedOnUser { get; set; }
    public string? AssetReference { get; set; }
    public string? AgentVersion { get; set; }
    public DateTimeOffset? LastSeenAt { get; set; }
    public int? CpuPercent { get; set; }
    public decimal? MemoryUsedGb { get; set; }
    public decimal? MemoryTotalGb { get; set; }
    public decimal? DiskUsedGb { get; set; }
    public decimal? DiskTotalGb { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AgentPrompt
{
    public Guid Id { get; set; }
    public Guid DeviceId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public required string SourceModule { get; set; }
    public string? SourceReference { get; set; }
    public required string PromptType { get; set; }
    public required string TitleTh { get; set; }
    public required string TitleEn { get; set; }
    public required string MessageTh { get; set; }
    public required string MessageEn { get; set; }
    public required string Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RespondedAt { get; set; }
    public Guid? RespondedByUserId { get; set; }
    public string? ResponseKey { get; set; }
    public long Version { get; set; } = 1;
}

public sealed class RemoteConsentRequest
{
    public Guid Id { get; set; }
    public Guid DeviceId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public required string OperatorName { get; set; }
    public string? OperatorRole { get; set; }
    public required string Mode { get; set; }
    public required string MessageTh { get; set; }
    public required string MessageEn { get; set; }
    public required string Status { get; set; }
    public DateTimeOffset RequestedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public long Version { get; set; } = 1;
}

public sealed class DeviceExternalMapping
{
    public Guid Id { get; set; }
    public Guid DeviceId { get; set; }
    public required string Provider { get; set; }
    public required string ExternalId { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class DeviceGroup
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public required string GroupType { get; set; }
    public Guid? OrganizationUnitId { get; set; }
    public Guid? LocationId { get; set; }
    public string? ExternalProvider { get; set; }
    public string? ExternalGroupId { get; set; }
    public required string SyncStatus { get; set; }
    public DateTimeOffset? LastSyncedAt { get; set; }
    public required string Status { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class DeviceGroupMember
{
    public Guid GroupId { get; set; }
    public Guid DeviceId { get; set; }
    public DateTimeOffset ResolvedAt { get; set; }
}

public sealed class DiscoveryScan
{
    public Guid Id { get; set; }
    public Guid OperationId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public required string RangesJson { get; set; }
    public required string Status { get; set; }
    public int Progress { get; set; }
    public int AddressesScanned { get; set; }
    public int DevicesFound { get; set; }
    public int UnmanagedCount { get; set; }
    public string? ErrorCode { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class DiscoveryResult
{
    public Guid Id { get; set; }
    public Guid ScanId { get; set; }
    public required string IpAddress { get; set; }
    public string? Hostname { get; set; }
    public string? DetectedOperatingSystem { get; set; }
    public string? Vendor { get; set; }
    public required string DiscoveryMethod { get; set; }
    public required string ManagementStatus { get; set; }
    public Guid? MatchedDeviceId { get; set; }
    public DateTimeOffset DiscoveredAt { get; set; }
}


public sealed class DeviceSoftwareInventorySnapshot
{
    public Guid Id { get; set; }
    public Guid DeviceId { get; set; }
    public DateTimeOffset ObservedAt { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
    public required string Completeness { get; set; }
    public required string Source { get; set; }
    public string? SourceInstance { get; set; }
    public int PackageCount { get; set; }
}

public sealed class DeviceInstalledSoftware
{
    public Guid Id { get; set; }
    public Guid SnapshotId { get; set; }
    public required string ProductKey { get; set; }
    public required string DisplayName { get; set; }
    public string? Version { get; set; }
    public string? Publisher { get; set; }
    public string? Architecture { get; set; }
}


public sealed class InventoryQuery
{
    public Guid Id { get; set; }
    public Guid CreatedByUserId { get; set; }
    public required string Name { get; set; }
    public required string FactType { get; set; }
    public required string Field { get; set; }
    public required string Operator { get; set; }
    public required string Value { get; set; }
    public required string ScopeType { get; set; }
    public Guid? ScopeId { get; set; }
    public required string Status { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class InventoryQueryRun
{
    public Guid Id { get; set; }
    public Guid OperationId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public Guid? SavedQueryId { get; set; }
    public required string DefinitionJson { get; set; }
    public required string AccessScopeJson { get; set; }
    public required string Status { get; set; }
    public int Progress { get; set; }
    public int DevicesEvaluated { get; set; }
    public int MatchCount { get; set; }
    public string? ErrorCode { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class InventoryQueryResult
{
    public Guid Id { get; set; }
    public Guid RunId { get; set; }
    public Guid DeviceId { get; set; }
    public required string FactType { get; set; }
    public required string FactName { get; set; }
    public string? FactVersion { get; set; }
    public string? FactPublisher { get; set; }
    public required string MatchedValue { get; set; }
    public DateTimeOffset ObservedAt { get; set; }
}
