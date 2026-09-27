using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Assets.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step23ContractsWarranty : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "contracts",
                schema: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    contract_number = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    fiscal_year = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    vendor = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    start_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    end_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    service_type = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    service_condition = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    warranty_terms = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    contact_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    contact_phone = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    contact_email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    record_status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_contracts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "asset_contract_links",
                schema: "assets",
                columns: table => new
                {
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    contract_id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    linked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_asset_contract_links", x => new { x.asset_id, x.contract_id });
                    table.ForeignKey(
                        name: "fk_asset_contract_links_assets_asset_id",
                        column: x => x.asset_id,
                        principalSchema: "assets",
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_asset_contract_links_contracts_contract_id",
                        column: x => x.contract_id,
                        principalSchema: "assets",
                        principalTable: "contracts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_asset_contract_links_contract_id",
                schema: "assets",
                table: "asset_contract_links",
                column: "contract_id");

            migrationBuilder.CreateIndex(
                name: "ix_contracts_contract_number",
                schema: "assets",
                table: "contracts",
                column: "contract_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_contracts_end_at_record_status",
                schema: "assets",
                table: "contracts",
                columns: new[] { "end_at", "record_status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "asset_contract_links",
                schema: "assets");

            migrationBuilder.DropTable(
                name: "contracts",
                schema: "assets");
        }
    }
}
