using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Assets.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step20AssetCustomFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "custom_field_definitions",
                schema: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    field_key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    field_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    is_required = table.Column<bool>(type: "boolean", nullable: false),
                    show_in_agent = table.Column<bool>(type: "boolean", nullable: false),
                    status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    options_json = table.Column<string>(type: "jsonb", nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_custom_field_definitions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "custom_field_values",
                schema: "assets",
                columns: table => new
                {
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    field_id = table.Column<Guid>(type: "uuid", nullable: false),
                    value_json = table.Column<string>(type: "jsonb", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_custom_field_values", x => new { x.asset_id, x.field_id });
                    table.ForeignKey(
                        name: "fk_custom_field_values_assets_asset_id",
                        column: x => x.asset_id,
                        principalSchema: "assets",
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_custom_field_values_custom_field_definitions_field_id",
                        column: x => x.field_id,
                        principalSchema: "assets",
                        principalTable: "custom_field_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_custom_field_definitions_field_key",
                schema: "assets",
                table: "custom_field_definitions",
                column: "field_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_custom_field_values_field_id",
                schema: "assets",
                table: "custom_field_values",
                column: "field_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "custom_field_values",
                schema: "assets");

            migrationBuilder.DropTable(
                name: "custom_field_definitions",
                schema: "assets");
        }
    }
}
