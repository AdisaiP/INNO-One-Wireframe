namespace INNO.One.Modules.Assets.Domain;

public sealed class Asset
{
    public Guid Id { get; set; }
    public required string AssetTag { get; set; }
    public required string Name { get; set; }
    public required string Category { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public string? SerialNumber { get; set; }
    public required string LifecycleStatus { get; set; }
    public Guid? OwnerUserId { get; set; }
    public Guid? OrganizationUnitId { get; set; }
    public Guid? LocationId { get; set; }
    public Guid? LinkedDeviceId { get; set; }
    public decimal? PurchasePrice { get; set; }
    public DateTimeOffset RegisteredAt { get; set; }
    public DateTimeOffset? WarrantyEndAt { get; set; }
    public required string Source { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AssetOwnershipHistory
{
    public Guid Id { get; set; }
    public Guid AssetId { get; set; }
    public Guid? PreviousOwnerUserId { get; set; }
    public Guid? OwnerUserId { get; set; }
    public Guid ChangedByUserId { get; set; }
    public required string ReasonCode { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset EffectiveAt { get; set; }
}

public sealed class OwnershipSubmission
{
    public Guid Id { get; set; }
    public Guid AssetId { get; set; }
    public Guid UserId { get; set; }
    public required string DeviceName { get; set; }
    public required string Possession { get; set; }
    public string? SubmittedLocation { get; set; }
    public required string ChangesJson { get; set; }
    public required string Status { get; set; }
    public DateTimeOffset SubmittedAt { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? DecisionNote { get; set; }
    public long Version { get; set; } = 1;
}


public sealed class AssetCustomFieldDefinition
{
    public Guid Id { get; set; }
    public required string FieldKey { get; set; }
    public required string Label { get; set; }
    public required string FieldType { get; set; }
    public bool IsRequired { get; set; }
    public bool ShowInAgent { get; set; }
    public required string Status { get; set; }
    public required string OptionsJson { get; set; }
    public int DisplayOrder { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AssetCustomFieldValue
{
    public Guid AssetId { get; set; }
    public Guid FieldId { get; set; }
    public required string ValueJson { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}


public sealed class AssetQrLabel
{
    public Guid Id { get; set; }
    public Guid AssetId { get; set; }
    public required string TokenFingerprint { get; set; }
    public required string Status { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset? LastPrintedAt { get; set; }
}

public sealed class AssetQrScan
{
    public Guid Id { get; set; }
    public Guid AssetId { get; set; }
    public Guid LabelId { get; set; }
    public Guid ScannerUserId { get; set; }
    public DateTimeOffset ScannedAt { get; set; }
    public required string Outcome { get; set; }
}


public sealed class SoftwareLicense
{
    public Guid Id { get; set; }
    public required string ProductName { get; set; }
    public required string Vendor { get; set; }
    public required string LicenseModel { get; set; }
    public int EntitledSeats { get; set; }
    public decimal? UnitPrice { get; set; }
    public required string Currency { get; set; }
    public DateTimeOffset? RenewalAt { get; set; }
    public string? ContractReference { get; set; }
    public required string Status { get; set; }
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class LicenseAllocation
{
    public Guid Id { get; set; }
    public Guid SoftwareLicenseId { get; set; }
    public Guid? AssetId { get; set; }
    public required string EndpointName { get; set; }
    public string? AssignedTo { get; set; }
    public int SeatCount { get; set; } = 1;
    public DateTimeOffset? LastUsedAt { get; set; }
    public required string UsageStatus { get; set; }
    public required string Source { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}


public sealed class AssetContract
{
    public Guid Id { get; set; }
    public required string ContractNumber { get; set; }
    public required string FiscalYear { get; set; }
    public required string Vendor { get; set; }
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public required string ServiceType { get; set; }
    public string? ServiceCondition { get; set; }
    public string? WarrantyTerms { get; set; }
    public string? ContactName { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public required string RecordStatus { get; set; }
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AssetContractLink
{
    public Guid AssetId { get; set; }
    public Guid ContractId { get; set; }
    public required string CoverageStatus { get; set; }
    public DateTimeOffset LinkedAt { get; set; }
}


public sealed class SoftwareBaseline
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string? TargetCategory { get; set; }
    public required string RequiredPackagesJson { get; set; }
    public required string Status { get; set; }
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}


public sealed class SoftwareBaselineResult
{
    public Guid Id { get; set; }
    public Guid BaselineId { get; set; }
    public Guid AssetId { get; set; }
    public required string ResultStatus { get; set; }
    public required string ReasonCode { get; set; }
    public required string MissingPackagesJson { get; set; }
    public string? InventorySnapshotReference { get; set; }
    public DateTimeOffset? InventoryObservedAt { get; set; }
    public int BaselineVersion { get; set; }
    public DateTimeOffset EvaluatedAt { get; set; }
    public int Version { get; set; } = 1;
}
