using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step16DevicesManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "description",
                schema: "devices",
                table: "device_groups",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "external_group_id",
                schema: "devices",
                table: "device_groups",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "external_provider",
                schema: "devices",
                table: "device_groups",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "last_synced_at",
                schema: "devices",
                table: "device_groups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "location_id",
                schema: "devices",
                table: "device_groups",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "organization_unit_id",
                schema: "devices",
                table: "device_groups",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sync_status",
                schema: "devices",
                table: "device_groups",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "local");

            migrationBuilder.CreateTable(
                name: "discovery_scans",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    operation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ranges_json = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    progress = table.Column<int>(type: "integer", nullable: false),
                    addresses_scanned = table.Column<int>(type: "integer", nullable: false),
                    devices_found = table.Column<int>(type: "integer", nullable: false),
                    unmanaged_count = table.Column<int>(type: "integer", nullable: false),
                    error_code = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_discovery_scans", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "discovery_results",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    scan_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ip_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    hostname = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    detected_operating_system = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    vendor = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    discovery_method = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    management_status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    matched_device_id = table.Column<Guid>(type: "uuid", nullable: true),
                    discovered_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_discovery_results", x => x.id);
                    table.ForeignKey(
                        name: "fk_discovery_results_discovery_scans_scan_id",
                        column: x => x.scan_id,
                        principalSchema: "devices",
                        principalTable: "discovery_scans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_device_groups_external_provider_external_group_id",
                schema: "devices",
                table: "device_groups",
                columns: new[] { "external_provider", "external_group_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_discovery_results_matched_device_id",
                schema: "devices",
                table: "discovery_results",
                column: "matched_device_id");

            migrationBuilder.CreateIndex(
                name: "ix_discovery_results_scan_id_ip_address",
                schema: "devices",
                table: "discovery_results",
                columns: new[] { "scan_id", "ip_address" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_discovery_scans_operation_id",
                schema: "devices",
                table: "discovery_scans",
                column: "operation_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_discovery_scans_status_created_at",
                schema: "devices",
                table: "discovery_scans",
                columns: new[] { "status", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "discovery_results",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "discovery_scans",
                schema: "devices");

            migrationBuilder.DropIndex(
                name: "ix_device_groups_external_provider_external_group_id",
                schema: "devices",
                table: "device_groups");

            migrationBuilder.DropColumn(
                name: "description",
                schema: "devices",
                table: "device_groups");

            migrationBuilder.DropColumn(
                name: "external_group_id",
                schema: "devices",
                table: "device_groups");

            migrationBuilder.DropColumn(
                name: "external_provider",
                schema: "devices",
                table: "device_groups");

            migrationBuilder.DropColumn(
                name: "last_synced_at",
                schema: "devices",
                table: "device_groups");

            migrationBuilder.DropColumn(
                name: "location_id",
                schema: "devices",
                table: "device_groups");

            migrationBuilder.DropColumn(
                name: "organization_unit_id",
                schema: "devices",
                table: "device_groups");

            migrationBuilder.DropColumn(
                name: "sync_status",
                schema: "devices",
                table: "device_groups");
        }
    }
}
