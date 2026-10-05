using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45RDeviceHardwareInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "device_inventory_snapshots",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    observed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completeness = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    source = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    source_instance = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    manufacturer = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    model = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    serial_number = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    processor = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    bios_version = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    operating_system = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    memory_total_gb = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    memory_slots_used = table.Column<int>(type: "integer", nullable: true),
                    memory_slots_total = table.Column<int>(type: "integer", nullable: true),
                    ip_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    mac_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_inventory_snapshots", x => x.id);
                    table.ForeignKey(
                        name: "fk_device_inventory_snapshots_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                INSERT INTO devices.device_inventory_snapshots
                    (id, device_id, observed_at, received_at, completeness, source, source_instance,
                     manufacturer, model, serial_number, processor, bios_version, operating_system,
                     memory_total_gb, memory_slots_used, memory_slots_total, ip_address, mac_address)
                SELECT
                    md5(d.id::text || ':step45r-hardware')::uuid,
                    d.id,
                    COALESCE(d.last_seen_at, d.updated_at),
                    CURRENT_TIMESTAMP,
                    'partial',
                    'legacy_device_row',
                    'step45r-backfill',
                    d.manufacturer,
                    d.model,
                    d.serial_number,
                    d.processor,
                    d.bios_version,
                    d.operating_system,
                    d.memory_total_gb,
                    NULL,
                    NULL,
                    d.ip_address,
                    d.mac_address
                FROM devices.devices d
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM devices.device_inventory_snapshots s
                    WHERE s.device_id = d.id
                );
                """);

            migrationBuilder.CreateIndex(
                name: "ix_device_inventory_snapshots_device_id_observed_at",
                schema: "devices",
                table: "device_inventory_snapshots",
                columns: new[] { "device_id", "observed_at" });

            migrationBuilder.CreateIndex(
                name: "ix_device_inventory_snapshots_device_id_observed_at_source",
                schema: "devices",
                table: "device_inventory_snapshots",
                columns: new[] { "device_id", "observed_at", "source" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "device_inventory_snapshots",
                schema: "devices");
        }
    }
}
