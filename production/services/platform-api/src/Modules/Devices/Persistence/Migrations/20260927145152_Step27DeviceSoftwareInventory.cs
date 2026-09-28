using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step27DeviceSoftwareInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "software_inventory_snapshots",
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
                    package_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_software_inventory_snapshots", x => x.id);
                    table.ForeignKey(
                        name: "fk_software_inventory_snapshots_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "installed_software",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    snapshot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_key = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    display_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    version = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    publisher = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    architecture = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_installed_software", x => x.id);
                    table.ForeignKey(
                        name: "fk_installed_software_software_inventory_snapshots_snapshot_id",
                        column: x => x.snapshot_id,
                        principalSchema: "devices",
                        principalTable: "software_inventory_snapshots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_installed_software_snapshot_id_product_key",
                schema: "devices",
                table: "installed_software",
                columns: new[] { "snapshot_id", "product_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_software_inventory_snapshots_device_id_observed_at",
                schema: "devices",
                table: "software_inventory_snapshots",
                columns: new[] { "device_id", "observed_at" });

            migrationBuilder.CreateIndex(
                name: "ix_software_inventory_snapshots_device_id_observed_at_source",
                schema: "devices",
                table: "software_inventory_snapshots",
                columns: new[] { "device_id", "observed_at", "source" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "installed_software",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "software_inventory_snapshots",
                schema: "devices");
        }
    }
}
