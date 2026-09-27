using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Assets.Migrations
{
    /// <inheritdoc />
    public partial class Step19AssetsCore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "assets");

            migrationBuilder.CreateTable(
                name: "assets",
                schema: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_tag = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    brand = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    model = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    serial_number = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    lifecycle_status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    organization_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    location_id = table.Column<Guid>(type: "uuid", nullable: true),
                    linked_device_id = table.Column<Guid>(type: "uuid", nullable: true),
                    purchase_price = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    registered_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    warranty_end_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    source = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_assets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "asset_ownership_history",
                schema: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    previous_owner_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    changed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason_code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    effective_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_asset_ownership_history", x => x.id);
                    table.ForeignKey(
                        name: "fk_asset_ownership_history_assets_asset_id",
                        column: x => x.asset_id,
                        principalSchema: "assets",
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ownership_submissions",
                schema: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    possession = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    submitted_location = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    changes_json = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    reviewed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    decision_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ownership_submissions", x => x.id);
                    table.ForeignKey(
                        name: "fk_ownership_submissions_assets_asset_id",
                        column: x => x.asset_id,
                        principalSchema: "assets",
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_asset_ownership_history_asset_id_effective_at",
                schema: "assets",
                table: "asset_ownership_history",
                columns: new[] { "asset_id", "effective_at" });

            migrationBuilder.CreateIndex(
                name: "ix_assets_asset_tag",
                schema: "assets",
                table: "assets",
                column: "asset_tag",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_assets_owner_user_id_lifecycle_status",
                schema: "assets",
                table: "assets",
                columns: new[] { "owner_user_id", "lifecycle_status" });

            migrationBuilder.CreateIndex(
                name: "ix_ownership_submissions_asset_id",
                schema: "assets",
                table: "ownership_submissions",
                column: "asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_ownership_submissions_status_submitted_at",
                schema: "assets",
                table: "ownership_submissions",
                columns: new[] { "status", "submitted_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "asset_ownership_history",
                schema: "assets");

            migrationBuilder.DropTable(
                name: "ownership_submissions",
                schema: "assets");

            migrationBuilder.DropTable(
                name: "assets",
                schema: "assets");
        }
    }
}
