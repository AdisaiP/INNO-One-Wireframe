using INNO.One.Modules.Assets.Domain;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Infrastructure;

public static class AssetsDevelopmentSeed
{
    public static readonly Guid AssetHrDesktopId = Guid.Parse("90000000-0000-0000-0000-000000000001");
    public static readonly Guid AssetItNotebookId = Guid.Parse("90000000-0000-0000-0000-000000000002");
    public static readonly Guid AssetMonitorId = Guid.Parse("90000000-0000-0000-0000-000000000003");
    public static readonly Guid AssetFinanceDesktopId = Guid.Parse("90000000-0000-0000-0000-000000000004");
    public static readonly Guid AssetPrinterId = Guid.Parse("90000000-0000-0000-0000-000000000005");

    private static readonly Guid AdisaiUserId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid SupportUserId = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly Guid SomchaiUserId = Guid.Parse("10000000-0000-0000-0000-000000000004");
    private static readonly Guid DigitalTechnologyId = Guid.Parse("20000000-0000-0000-0000-000000000002");
    private static readonly Guid HumanResourcesId = Guid.Parse("20000000-0000-0000-0000-000000000003");
    private static readonly Guid FinanceId = Guid.Parse("20000000-0000-0000-0000-000000000004");
    private static readonly Guid BangkokLocationId = Guid.Parse("30000000-0000-0000-0000-000000000001");

    public static async Task SeedAsync(
        AssetsDbContext db,
        CancellationToken cancellationToken = default)
    {
        if (await db.Assets.AnyAsync(cancellationToken))
        {
            await EnsureCustomFieldsAsync(db, cancellationToken);
            return;
        }

        var now = DateTimeOffset.UtcNow;

        var assets = new[]
        {
            Asset(
                AssetHrDesktopId, "AST-PC-000142", "HR Desktop", "Computer",
                "Dell", "OptiPlex 7010", "DL7K-88421", "in_use",
                SomchaiUserId, HumanResourcesId, BangkokLocationId,
                Guid.Parse("80000000-0000-0000-0000-000000000001"),
                34900m, now.AddYears(-1).AddMonths(-8), now.AddYears(1).AddMonths(3),
                "devices_sync", now),
            Asset(
                AssetItNotebookId, "AST-NB-000003", "Developer Notebook", "Notebook",
                "Lenovo", "ThinkPad T14", "LNV-23314", "in_use",
                AdisaiUserId, DigitalTechnologyId, BangkokLocationId,
                Guid.Parse("80000000-0000-0000-0000-000000000002"),
                52900m, now.AddMonths(-11), now.AddYears(2),
                "devices_sync", now),
            Asset(
                AssetMonitorId, "AST-MON-000311", "Spare Monitor", "Monitor",
                "Dell", "P2425H", "CN0-88317", "stock",
                null, DigitalTechnologyId, BangkokLocationId,
                null, 6200m, now.AddMonths(-6), now.AddYears(2).AddMonths(6),
                "asset_register", now),
            Asset(
                AssetFinanceDesktopId, "AST-PC-000178", "Finance Pool Desktop", "Computer",
                "HP", "ProDesk 600", "HP-73382", "repair",
                null, FinanceId, BangkokLocationId,
                Guid.Parse("80000000-0000-0000-0000-000000000004"),
                31900m, now.AddYears(-1).AddMonths(-2), now.AddMonths(10),
                "devices_sync", now),
            Asset(
                AssetPrinterId, "AST-PRN-000041", "Finance Laser Printer", "Printer",
                "HP", "LaserJet M404", "PRN-44091", "in_use",
                SupportUserId, FinanceId, BangkokLocationId,
                null, 12400m, now.AddYears(-2), now.AddMonths(5),
                "asset_register", now)
        };

        db.Assets.AddRange(assets);

        db.AssetOwnershipHistory.AddRange(
            Ownership(assets[0].Id, null, SomchaiUserId, SomchaiUserId, "initial_assignment", now.AddMonths(-18)),
            Ownership(assets[1].Id, null, AdisaiUserId, AdisaiUserId, "initial_assignment", now.AddMonths(-11)),
            Ownership(assets[4].Id, null, SupportUserId, SupportUserId, "initial_assignment", now.AddYears(-1)));

        db.OwnershipSubmissions.AddRange(
            new OwnershipSubmission
            {
                Id = Guid.Parse("91000000-0000-0000-0000-000000000001"),
                AssetId = AssetItNotebookId,
                UserId = AdisaiUserId,
                DeviceName = "NOTEBOOK-IT-003",
                Possession = "assigned",
                SubmittedLocation = "Bangkok Office · Floor 3",
                ChangesJson = """{"owner":"confirmed","location":"confirmed"}""",
                Status = "pending",
                SubmittedAt = now.AddMinutes(-35)
            },
            new OwnershipSubmission
            {
                Id = Guid.Parse("91000000-0000-0000-0000-000000000002"),
                AssetId = AssetHrDesktopId,
                UserId = SomchaiUserId,
                DeviceName = "DESKTOP-HR-014",
                Possession = "assigned",
                SubmittedLocation = "Bangkok Office · Floor 3",
                ChangesJson = """{"owner":"confirmed"}""",
                Status = "confirmed",
                SubmittedAt = now.AddDays(-1),
                ReviewedByUserId = AdisaiUserId,
                ReviewedAt = now.AddHours(-20),
                DecisionNote = "Confirmed against current assignment."
            });

        await db.SaveChangesAsync(cancellationToken);
        await EnsureCustomFieldsAsync(db, cancellationToken);
    }

    private static async Task EnsureCustomFieldsAsync(
        AssetsDbContext db,
        CancellationToken cancellationToken)
    {
        if (await db.CustomFieldDefinitions.AnyAsync(cancellationToken))
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var costCenterId = Guid.Parse("92000000-0000-0000-0000-000000000001");
        var officeZoneId = Guid.Parse("92000000-0000-0000-0000-000000000002");
        var criticalityId = Guid.Parse("92000000-0000-0000-0000-000000000003");
        var noteId = Guid.Parse("92000000-0000-0000-0000-000000000004");

        db.CustomFieldDefinitions.AddRange(
            new AssetCustomFieldDefinition
            {
                Id = costCenterId,
                FieldKey = "cost_center",
                Label = "Cost Center",
                FieldType = "text",
                IsRequired = true,
                ShowInAgent = true,
                Status = "active",
                OptionsJson = "[]",
                DisplayOrder = 0,
                CreatedAt = now,
                UpdatedAt = now
            },
            new AssetCustomFieldDefinition
            {
                Id = officeZoneId,
                FieldKey = "office_zone",
                Label = "Office Zone",
                FieldType = "select",
                IsRequired = false,
                ShowInAgent = true,
                Status = "active",
                OptionsJson = """["Floor 2","Floor 3","Warehouse"]""",
                DisplayOrder = 1,
                CreatedAt = now,
                UpdatedAt = now
            },
            new AssetCustomFieldDefinition
            {
                Id = criticalityId,
                FieldKey = "asset_criticality",
                Label = "Asset Criticality",
                FieldType = "select",
                IsRequired = true,
                ShowInAgent = false,
                Status = "active",
                OptionsJson = """["Low","Standard","High","Critical"]""",
                DisplayOrder = 2,
                CreatedAt = now,
                UpdatedAt = now
            },
            new AssetCustomFieldDefinition
            {
                Id = noteId,
                FieldKey = "maintenance_note",
                Label = "Maintenance Note",
                FieldType = "text",
                IsRequired = false,
                ShowInAgent = false,
                Status = "draft",
                OptionsJson = "[]",
                DisplayOrder = 3,
                CreatedAt = now,
                UpdatedAt = now
            });

        db.CustomFieldValues.AddRange(
            Value(AssetHrDesktopId, costCenterId, "\"HR-OPS\"", now),
            Value(AssetHrDesktopId, officeZoneId, "\"Floor 3\"", now),
            Value(AssetHrDesktopId, criticalityId, "\"Standard\"", now),
            Value(AssetItNotebookId, costCenterId, "\"DT-ENG\"", now),
            Value(AssetItNotebookId, officeZoneId, "\"Floor 3\"", now),
            Value(AssetItNotebookId, criticalityId, "\"High\"", now),
            Value(AssetMonitorId, costCenterId, "\"DT-STOCK\"", now),
            Value(AssetMonitorId, criticalityId, "\"Low\"", now),
            Value(AssetFinanceDesktopId, costCenterId, "\"FIN-OPS\"", now),
            Value(AssetFinanceDesktopId, criticalityId, "\"High\"", now),
            Value(AssetPrinterId, costCenterId, "\"FIN-OPS\"", now),
            Value(AssetPrinterId, officeZoneId, "\"Floor 2\"", now),
            Value(AssetPrinterId, criticalityId, "\"Standard\"", now));

        await db.SaveChangesAsync(cancellationToken);
    }

    private static AssetCustomFieldValue Value(
        Guid assetId,
        Guid fieldId,
        string json,
        DateTimeOffset now) =>
        new()
        {
            AssetId = assetId,
            FieldId = fieldId,
            ValueJson = json,
            UpdatedAt = now
        };

    private static Asset Asset(
        Guid id,
        string tag,
        string name,
        string category,
        string brand,
        string model,
        string serial,
        string status,
        Guid? ownerUserId,
        Guid? organizationId,
        Guid? locationId,
        Guid? linkedDeviceId,
        decimal? purchasePrice,
        DateTimeOffset registeredAt,
        DateTimeOffset? warrantyEndAt,
        string source,
        DateTimeOffset now) =>
        new()
        {
            Id = id,
            AssetTag = tag,
            Name = name,
            Category = category,
            Brand = brand,
            Model = model,
            SerialNumber = serial,
            LifecycleStatus = status,
            OwnerUserId = ownerUserId,
            OrganizationUnitId = organizationId,
            LocationId = locationId,
            LinkedDeviceId = linkedDeviceId,
            PurchasePrice = purchasePrice,
            RegisteredAt = registeredAt,
            WarrantyEndAt = warrantyEndAt,
            Source = source,
            CreatedAt = now,
            UpdatedAt = now
        };

    private static AssetOwnershipHistory Ownership(
        Guid assetId,
        Guid? previousOwner,
        Guid? owner,
        Guid changedBy,
        string reason,
        DateTimeOffset effectiveAt) =>
        new()
        {
            Id = Guid.NewGuid(),
            AssetId = assetId,
            PreviousOwnerUserId = previousOwner,
            OwnerUserId = owner,
            ChangedByUserId = changedBy,
            ReasonCode = reason,
            EffectiveAt = effectiveAt
        };
}
