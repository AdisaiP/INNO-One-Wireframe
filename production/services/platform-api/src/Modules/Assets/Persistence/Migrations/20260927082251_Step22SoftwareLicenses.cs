using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Assets.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step22SoftwareLicenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "software_licenses",
                schema: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    vendor = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    license_model = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    entitled_seats = table.Column<int>(type: "integer", nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    renewal_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    contract_reference = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_software_licenses", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "license_allocations",
                schema: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    software_license_id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    endpoint_name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    assigned_to = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    seat_count = table.Column<int>(type: "integer", nullable: false),
                    last_used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    usage_status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    source = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_license_allocations", x => x.id);
                    table.ForeignKey(
                        name: "fk_license_allocations_assets_asset_id",
                        column: x => x.asset_id,
                        principalSchema: "assets",
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_license_allocations_software_licenses_software_license_id",
                        column: x => x.software_license_id,
                        principalSchema: "assets",
                        principalTable: "software_licenses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_license_allocations_asset_id",
                schema: "assets",
                table: "license_allocations",
                column: "asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_license_allocations_software_license_id_usage_status",
                schema: "assets",
                table: "license_allocations",
                columns: new[] { "software_license_id", "usage_status" });

            migrationBuilder.CreateIndex(
                name: "ix_software_licenses_vendor_product_name",
                schema: "assets",
                table: "software_licenses",
                columns: new[] { "vendor", "product_name" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "license_allocations",
                schema: "assets");

            migrationBuilder.DropTable(
                name: "software_licenses",
                schema: "assets");
        }
    }
}
