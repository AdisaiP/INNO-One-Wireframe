using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45SPerformanceNetwork : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "agent_latency_ms",
                schema: "devices",
                table: "device_inventory_snapshots",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "dns_servers",
                schema: "devices",
                table: "device_inventory_snapshots",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "gateway",
                schema: "devices",
                table: "device_inventory_snapshots",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "network_adapter_name",
                schema: "devices",
                table: "device_inventory_snapshots",
                type: "character varying(240)",
                maxLength: 240,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "network_observed_at",
                schema: "devices",
                table: "device_inventory_snapshots",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "network_received_at",
                schema: "devices",
                table: "device_inventory_snapshots",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "network_source",
                schema: "devices",
                table: "device_inventory_snapshots",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "network_source_instance",
                schema: "devices",
                table: "device_inventory_snapshots",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "packet_loss_percent",
                schema: "devices",
                table: "device_inventory_snapshots",
                type: "numeric(7,3)",
                precision: 7,
                scale: 3,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "subnet_mask",
                schema: "devices",
                table: "device_inventory_snapshots",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "device_performance_samples",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    observed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    source = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    source_instance = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    cpu_percent = table.Column<int>(type: "integer", nullable: true),
                    memory_used_gb = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    memory_total_gb = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    disk_used_gb = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    disk_total_gb = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_performance_samples", x => x.id);
                    table.ForeignKey(
                        name: "fk_device_performance_samples_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                INSERT INTO devices.device_performance_samples
                    (id, device_id, observed_at, received_at, source, source_instance,
                     cpu_percent, memory_used_gb, memory_total_gb, disk_used_gb, disk_total_gb)
                SELECT
                    md5(d.id::text || ':step45s-performance')::uuid,
                    d.id,
                    COALESCE(d.last_seen_at, d.updated_at),
                    CURRENT_TIMESTAMP,
                    'legacy_device_row',
                    'step45s-backfill',
                    d.cpu_percent,
                    d.memory_used_gb,
                    d.memory_total_gb,
                    d.disk_used_gb,
                    d.disk_total_gb
                FROM devices.devices d
                WHERE d.cpu_percent IS NOT NULL
                   OR d.memory_used_gb IS NOT NULL
                   OR d.disk_used_gb IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                UPDATE devices.device_inventory_snapshots
                SET network_observed_at = observed_at,
                    network_received_at = received_at,
                    network_source = source,
                    network_source_instance = source_instance
                WHERE network_observed_at IS NULL
                  AND (ip_address IS NOT NULL OR mac_address IS NOT NULL);
                """);

            migrationBuilder.CreateIndex(
                name: "ix_device_performance_samples_device_id_observed_at",
                schema: "devices",
                table: "device_performance_samples",
                columns: new[] { "device_id", "observed_at" });

            migrationBuilder.CreateIndex(
                name: "ix_device_performance_samples_device_id_observed_at_source",
                schema: "devices",
                table: "device_performance_samples",
                columns: new[] { "device_id", "observed_at", "source" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "device_performance_samples",
                schema: "devices");

            migrationBuilder.DropColumn(
                name: "agent_latency_ms",
                schema: "devices",
                table: "device_inventory_snapshots");

            migrationBuilder.DropColumn(
                name: "dns_servers",
                schema: "devices",
                table: "device_inventory_snapshots");

            migrationBuilder.DropColumn(
                name: "gateway",
                schema: "devices",
                table: "device_inventory_snapshots");

            migrationBuilder.DropColumn(
                name: "network_adapter_name",
                schema: "devices",
                table: "device_inventory_snapshots");

            migrationBuilder.DropColumn(
                name: "network_observed_at",
                schema: "devices",
                table: "device_inventory_snapshots");

            migrationBuilder.DropColumn(
                name: "network_received_at",
                schema: "devices",
                table: "device_inventory_snapshots");

            migrationBuilder.DropColumn(
                name: "network_source",
                schema: "devices",
                table: "device_inventory_snapshots");

            migrationBuilder.DropColumn(
                name: "network_source_instance",
                schema: "devices",
                table: "device_inventory_snapshots");

            migrationBuilder.DropColumn(
                name: "packet_loss_percent",
                schema: "devices",
                table: "device_inventory_snapshots");

            migrationBuilder.DropColumn(
                name: "subnet_mask",
                schema: "devices",
                table: "device_inventory_snapshots");
        }
    }
}
