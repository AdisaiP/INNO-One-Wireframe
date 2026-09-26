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
    public required string GroupType { get; set; }
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
