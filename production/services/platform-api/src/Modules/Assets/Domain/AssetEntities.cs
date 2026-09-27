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
