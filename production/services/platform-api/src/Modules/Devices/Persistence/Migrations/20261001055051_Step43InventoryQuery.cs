using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step43InventoryQuery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "inventory_queries",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    fact_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    field = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    @operator = table.Column<string>(name: "operator", type: "character varying(64)", maxLength: 64, nullable: false),
                    value = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    scope_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    scope_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_queries", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "inventory_query_runs",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    operation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    saved_query_id = table.Column<Guid>(type: "uuid", nullable: true),
                    definition_json = table.Column<string>(type: "jsonb", nullable: false),
                    access_scope_json = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    progress = table.Column<int>(type: "integer", nullable: false),
                    devices_evaluated = table.Column<int>(type: "integer", nullable: false),
                    match_count = table.Column<int>(type: "integer", nullable: false),
                    error_code = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_query_runs", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_query_runs_inventory_queries_saved_query_id",
                        column: x => x.saved_query_id,
                        principalSchema: "devices",
                        principalTable: "inventory_queries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "inventory_query_results",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    fact_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    fact_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    fact_version = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    fact_publisher = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    matched_value = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    observed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_query_results", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_query_results_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_inventory_query_results_inventory_query_runs_run_id",
                        column: x => x.run_id,
                        principalSchema: "devices",
                        principalTable: "inventory_query_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_queries_created_by_user_id_name",
                schema: "devices",
                table: "inventory_queries",
                columns: new[] { "created_by_user_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_inventory_queries_status_updated_at",
                schema: "devices",
                table: "inventory_queries",
                columns: new[] { "status", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_query_results_device_id",
                schema: "devices",
                table: "inventory_query_results",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_query_results_run_id_device_id",
                schema: "devices",
                table: "inventory_query_results",
                columns: new[] { "run_id", "device_id" });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_query_runs_operation_id",
                schema: "devices",
                table: "inventory_query_runs",
                column: "operation_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_inventory_query_runs_saved_query_id",
                schema: "devices",
                table: "inventory_query_runs",
                column: "saved_query_id");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_query_runs_status_created_at",
                schema: "devices",
                table: "inventory_query_runs",
                columns: new[] { "status", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "inventory_query_results",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "inventory_query_runs",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "inventory_queries",
                schema: "devices");
        }
    }
}
