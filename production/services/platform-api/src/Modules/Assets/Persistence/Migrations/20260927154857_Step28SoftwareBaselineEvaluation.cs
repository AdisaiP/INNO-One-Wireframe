using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Assets.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step28SoftwareBaselineEvaluation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "baseline_results",
                schema: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    baseline_id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    reason_code = table.Column<string>(type: "character varying(48)", maxLength: 48, nullable: false),
                    missing_packages_json = table.Column<string>(type: "jsonb", nullable: false),
                    inventory_snapshot_reference = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    inventory_observed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    baseline_version = table.Column<int>(type: "integer", nullable: false),
                    evaluated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_baseline_results", x => x.id);
                    table.ForeignKey(
                        name: "fk_baseline_results_assets_asset_id",
                        column: x => x.asset_id,
                        principalSchema: "assets",
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_baseline_results_software_baselines_baseline_id",
                        column: x => x.baseline_id,
                        principalSchema: "assets",
                        principalTable: "software_baselines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_baseline_results_asset_id",
                schema: "assets",
                table: "baseline_results",
                column: "asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_baseline_results_baseline_id_asset_id",
                schema: "assets",
                table: "baseline_results",
                columns: new[] { "baseline_id", "asset_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_baseline_results_result_status_evaluated_at",
                schema: "assets",
                table: "baseline_results",
                columns: new[] { "result_status", "evaluated_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "baseline_results",
                schema: "assets");
        }
    }
}
