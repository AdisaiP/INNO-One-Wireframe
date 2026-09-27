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
            await EnsureSoftwareLicensesAsync(db, cancellationToken);
            await EnsureContractsAsync(db, cancellationToken);
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
        await EnsureSoftwareLicensesAsync(db, cancellationToken);
        await EnsureContractsAsync(db, cancellationToken);
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


    private static async Task EnsureSoftwareLicensesAsync(
        AssetsDbContext db,
        CancellationToken cancellationToken)
    {
        if (await db.SoftwareLicenses.AnyAsync(cancellationToken))
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var m365Id = Guid.Parse("93000000-0000-0000-0000-000000000001");
        var adobeId = Guid.Parse("93000000-0000-0000-0000-000000000002");
        var autocadId = Guid.Parse("93000000-0000-0000-0000-000000000003");
        var endpointId = Guid.Parse("93000000-0000-0000-0000-000000000004");

        db.SoftwareLicenses.AddRange(
            new SoftwareLicense
            {
                Id = m365Id,
                ProductName = "Microsoft 365 Apps",
                Vendor = "Microsoft",
                LicenseModel = "Enterprise Agreement",
                EntitledSeats = 200,
                UnitPrice = null,
                Currency = "THB",
                RenewalAt = now.AddMonths(9),
                ContractReference = "CTR-2569-SW-001",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new SoftwareLicense
            {
                Id = adobeId,
                ProductName = "Adobe Acrobat Pro",
                Vendor = "Adobe",
                LicenseModel = "Named User",
                EntitledSeats = 50,
                UnitPrice = 7800m,
                Currency = "THB",
                RenewalAt = new DateTimeOffset(now.Year, 12, 31, 0, 0, 0, TimeSpan.Zero),
                ContractReference = "CTR-2569-SW-002",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new SoftwareLicense
            {
                Id = autocadId,
                ProductName = "AutoCAD",
                Vendor = "Autodesk",
                LicenseModel = "Annual Subscription",
                EntitledSeats = 25,
                UnitPrice = 10000m,
                Currency = "THB",
                RenewalAt = now.AddMonths(5),
                ContractReference = "CTR-2569-SW-003",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new SoftwareLicense
            {
                Id = endpointId,
                ProductName = "Endpoint Protection",
                Vendor = "Security Vendor",
                LicenseModel = "Annual Subscription",
                EntitledSeats = 500,
                UnitPrice = 2400m,
                Currency = "THB",
                RenewalAt = now.AddMonths(3),
                ContractReference = "CTR-2569-SW-004",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            });

        db.LicenseAllocations.AddRange(
            Allocation(m365Id, AssetHrDesktopId, "DESKTOP-HR-014", "Somchai P.", 1, now.AddMinutes(-20), "active", now),
            Allocation(m365Id, AssetItNotebookId, "NOTEBOOK-IT-003", "Adisai P.", 1, now.AddHours(-2), "active", now),
            Allocation(m365Id, null, "Other detected endpoints", "Endpoint inventory", 195, now.AddHours(-4), "active", now),

            Allocation(adobeId, AssetHrDesktopId, "DESKTOP-HR-014", "Somchai P.", 1, now.AddMinutes(-45), "active", now),
            Allocation(adobeId, AssetItNotebookId, "NOTEBOOK-IT-003", "Adisai P.", 1, now.AddDays(-9), "active", now),
            Allocation(adobeId, AssetFinanceDesktopId, "PC-FIN-021", "Finance Pool", 1, now.AddDays(-47), "inactive", now),
            Allocation(adobeId, null, "Other detected endpoints", "Endpoint inventory", 60, now.AddHours(-5), "active", now),

            Allocation(autocadId, AssetItNotebookId, "NOTEBOOK-IT-003", "Adisai P.", 1, now.AddDays(-2), "active", now),
            Allocation(autocadId, null, "Other detected endpoints", "Endpoint inventory", 31, now.AddHours(-8), "active", now),

            Allocation(endpointId, AssetHrDesktopId, "DESKTOP-HR-014", "Somchai P.", 1, now.AddMinutes(-12), "active", now),
            Allocation(endpointId, AssetItNotebookId, "NOTEBOOK-IT-003", "Adisai P.", 1, now.AddMinutes(-18), "active", now),
            Allocation(endpointId, AssetFinanceDesktopId, "PC-FIN-021", "Finance Pool", 1, now.AddHours(-1), "active", now),
            Allocation(endpointId, AssetPrinterId, "PRINTER-FIN-041", "Finance", 1, now.AddHours(-3), "active", now),
            Allocation(endpointId, null, "Other detected endpoints", "Endpoint inventory", 502, now.AddMinutes(-30), "active", now));

        await db.SaveChangesAsync(cancellationToken);
    }


    private static async Task EnsureContractsAsync(
        AssetsDbContext db,
        CancellationToken cancellationToken)
    {
        if (await db.Contracts.AnyAsync(cancellationToken))
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var activeId = Guid.Parse("94000000-0000-0000-0000-000000000001");
        var expiringId = Guid.Parse("94000000-0000-0000-0000-000000000002");
        var expiredId = Guid.Parse("94000000-0000-0000-0000-000000000003");

        db.Contracts.AddRange(
            new AssetContract
            {
                Id = activeId,
                ContractNumber = "CTR-2568-IT-014",
                FiscalYear = "2568",
                Vendor = "ABC Technology Co., Ltd.",
                StartAt = now.AddMonths(-8),
                EndAt = now.AddMonths(15),
                ServiceType = "3 years onsite NBD",
                ServiceCondition = "Onsite within next business day",
                WarrantyTerms = "Parts and labor included during contract period.",
                ContactName = "Enterprise Support",
                ContactPhone = "02-555-9088",
                ContactEmail = "support@vendor.local",
                RecordStatus = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new AssetContract
            {
                Id = expiringId,
                ContractNumber = "CTR-2567-NB-006",
                FiscalYear = "2567",
                Vendor = "Notebook Solutions Ltd.",
                StartAt = now.AddYears(-2),
                EndAt = now.AddDays(60),
                ServiceType = "2 years carry-in",
                ServiceCondition = "Carry-in repair with 5 business-day target.",
                WarrantyTerms = "Mainboard, storage and display hardware coverage.",
                ContactName = "Notebook Support",
                ContactPhone = "02-555-7711",
                ContactEmail = "service@notebook.local",
                RecordStatus = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new AssetContract
            {
                Id = expiredId,
                ContractNumber = "CTR-2566-PRN-002",
                FiscalYear = "2566",
                Vendor = "Office Print Co.",
                StartAt = now.AddYears(-3),
                EndAt = now.AddDays(-120),
                ServiceType = "Maintenance",
                ServiceCondition = "Quarterly preventive maintenance.",
                WarrantyTerms = "Consumables excluded.",
                ContactName = "Printer Service",
                ContactPhone = "02-555-2266",
                ContactEmail = "support@print.local",
                RecordStatus = "active",
                CreatedAt = now,
                UpdatedAt = now
            });

        db.AssetContractLinks.AddRange(
            ContractLink(AssetHrDesktopId, activeId, now),
            ContractLink(AssetItNotebookId, activeId, now),
            ContractLink(AssetFinanceDesktopId, expiringId, now),
            ContractLink(AssetPrinterId, expiringId, now),
            ContractLink(AssetPrinterId, expiredId, now));

        await db.SaveChangesAsync(cancellationToken);
    }

    private static AssetContractLink ContractLink(
        Guid assetId,
        Guid contractId,
        DateTimeOffset now) =>
        new()
        {
            AssetId = assetId,
            ContractId = contractId,
            CoverageStatus = "covered",
            LinkedAt = now
        };

    private static LicenseAllocation Allocation(
        Guid licenseId,
        Guid? assetId,
        string endpointName,
        string assignedTo,
        int seatCount,
        DateTimeOffset? lastUsedAt,
        string status,
        DateTimeOffset now) =>
        new()
        {
            Id = Guid.NewGuid(),
            SoftwareLicenseId = licenseId,
            AssetId = assetId,
            EndpointName = endpointName,
            AssignedTo = assignedTo,
            SeatCount = seatCount,
            LastUsedAt = lastUsedAt,
            UsageStatus = status,
            Source = "endpoint_inventory",
            UpdatedAt = now
        };

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
