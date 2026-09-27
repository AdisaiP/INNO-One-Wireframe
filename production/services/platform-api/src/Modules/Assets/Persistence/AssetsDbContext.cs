using INNO.One.Modules.Assets.Domain;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Persistence;

public sealed class AssetsDbContext(DbContextOptions<AssetsDbContext> options) : DbContext(options)
{
    public const string Schema = "assets";

    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<AssetOwnershipHistory> AssetOwnershipHistory => Set<AssetOwnershipHistory>();
    public DbSet<OwnershipSubmission> OwnershipSubmissions => Set<OwnershipSubmission>();
    public DbSet<AssetCustomFieldDefinition> CustomFieldDefinitions => Set<AssetCustomFieldDefinition>();
    public DbSet<AssetCustomFieldValue> CustomFieldValues => Set<AssetCustomFieldValue>();
    public DbSet<AssetQrLabel> QrLabels => Set<AssetQrLabel>();
    public DbSet<AssetQrScan> QrScans => Set<AssetQrScan>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<Asset>(entity =>
        {
            entity.ToTable("assets");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.AssetTag).IsUnique();
            entity.HasIndex(x => new { x.OwnerUserId, x.LifecycleStatus });
            entity.Property(x => x.AssetTag).HasMaxLength(64);
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.Category).HasMaxLength(80);
            entity.Property(x => x.Brand).HasMaxLength(120);
            entity.Property(x => x.Model).HasMaxLength(160);
            entity.Property(x => x.SerialNumber).HasMaxLength(120);
            entity.Property(x => x.LifecycleStatus).HasMaxLength(40);
            entity.Property(x => x.PurchasePrice).HasPrecision(14, 2);
            entity.Property(x => x.Source).HasMaxLength(80);
            entity.Property(x => x.Version).IsConcurrencyToken();
        });

        modelBuilder.Entity<AssetOwnershipHistory>(entity =>
        {
            entity.ToTable("asset_ownership_history");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.AssetId, x.EffectiveAt });
            entity.Property(x => x.ReasonCode).HasMaxLength(80);
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.HasOne<Asset>()
                .WithMany()
                .HasForeignKey(x => x.AssetId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OwnershipSubmission>(entity =>
        {
            entity.ToTable("ownership_submissions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.Status, x.SubmittedAt });
            entity.Property(x => x.DeviceName).HasMaxLength(160);
            entity.Property(x => x.Possession).HasMaxLength(40);
            entity.Property(x => x.SubmittedLocation).HasMaxLength(200);
            entity.Property(x => x.ChangesJson).HasColumnType("jsonb");
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.Property(x => x.DecisionNote).HasMaxLength(500);
            entity.Property(x => x.Version).IsConcurrencyToken();
            entity.HasOne<Asset>()
                .WithMany()
                .HasForeignKey(x => x.AssetId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AssetCustomFieldDefinition>(entity =>
        {
            entity.ToTable("custom_field_definitions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.FieldKey).IsUnique();
            entity.Property(x => x.FieldKey).HasMaxLength(80);
            entity.Property(x => x.Label).HasMaxLength(160);
            entity.Property(x => x.FieldType).HasMaxLength(32);
            entity.Property(x => x.Status).HasMaxLength(24);
            entity.Property(x => x.OptionsJson).HasColumnType("jsonb");
            entity.Property(x => x.Version).IsConcurrencyToken();
        });

        modelBuilder.Entity<AssetCustomFieldValue>(entity =>
        {
            entity.ToTable("custom_field_values");
            entity.HasKey(x => new { x.AssetId, x.FieldId });
            entity.Property(x => x.ValueJson).HasColumnType("jsonb");
            entity.HasOne<Asset>()
                .WithMany()
                .HasForeignKey(x => x.AssetId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<AssetCustomFieldDefinition>()
                .WithMany()
                .HasForeignKey(x => x.FieldId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AssetQrLabel>(entity =>
        {
            entity.ToTable("qr_labels");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TokenFingerprint).IsUnique();
            entity.HasIndex(x => new { x.AssetId, x.Status });
            entity.Property(x => x.TokenFingerprint).HasMaxLength(64);
            entity.Property(x => x.Status).HasMaxLength(24);
            entity.HasOne<Asset>()
                .WithMany()
                .HasForeignKey(x => x.AssetId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AssetQrScan>(entity =>
        {
            entity.ToTable("qr_scans");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.AssetId, x.ScannedAt });
            entity.HasIndex(x => new { x.ScannerUserId, x.ScannedAt });
            entity.Property(x => x.Outcome).HasMaxLength(32);
            entity.HasOne<Asset>()
                .WithMany()
                .HasForeignKey(x => x.AssetId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<AssetQrLabel>()
                .WithMany()
                .HasForeignKey(x => x.LabelId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        base.OnModelCreating(modelBuilder);
    }
}
