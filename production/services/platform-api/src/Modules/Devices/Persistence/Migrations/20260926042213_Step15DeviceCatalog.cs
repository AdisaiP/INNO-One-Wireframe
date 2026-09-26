using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step15DeviceCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "devices");

            migrationBuilder.CreateTable(
                name: "device_groups",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    group_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_groups", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "devices",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hostname = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    device_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    connectivity_state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    organization_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    location_id = table.Column<Guid>(type: "uuid", nullable: true),
                    serial_number = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ip_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    mac_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    operating_system = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    manufacturer = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    model = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    processor = table.Column<string>(type: "text", nullable: true),
                    bios_version = table.Column<string>(type: "text", nullable: true),
                    logged_on_user = table.Column<string>(type: "text", nullable: true),
                    asset_reference = table.Column<string>(type: "text", nullable: true),
                    agent_version = table.Column<string>(type: "text", nullable: true),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    cpu_percent = table.Column<int>(type: "integer", nullable: true),
                    memory_used_gb = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    memory_total_gb = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    disk_used_gb = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    disk_total_gb = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_devices", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "device_external_mappings",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    external_id = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_external_mappings", x => x.id);
                    table.ForeignKey(
                        name: "fk_device_external_mappings_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "device_group_members",
                schema: "devices",
                columns: table => new
                {
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_group_members", x => new { x.group_id, x.device_id });
                    table.ForeignKey(
                        name: "fk_device_group_members_device_groups_group_id",
                        column: x => x.group_id,
                        principalSchema: "devices",
                        principalTable: "device_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_device_group_members_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_device_external_mappings_device_id",
                schema: "devices",
                table: "device_external_mappings",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "ix_device_external_mappings_provider_external_id",
                schema: "devices",
                table: "device_external_mappings",
                columns: new[] { "provider", "external_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_device_group_members_device_id",
                schema: "devices",
                table: "device_group_members",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "ix_device_groups_code",
                schema: "devices",
                table: "device_groups",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_devices_connectivity_state_organization_unit_id_last_seen_at",
                schema: "devices",
                table: "devices",
                columns: new[] { "connectivity_state", "organization_unit_id", "last_seen_at" });

            migrationBuilder.CreateIndex(
                name: "ix_devices_hostname",
                schema: "devices",
                table: "devices",
                column: "hostname",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_devices_location_id",
                schema: "devices",
                table: "devices",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "ix_devices_owner_user_id",
                schema: "devices",
                table: "devices",
                column: "owner_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "device_external_mappings",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "device_group_members",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "device_groups",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "devices",
                schema: "devices");
        }
    }
}
