using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Workflows.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45GWorkflowExecutionRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "workflow_runs",
                schema: "workflows",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_version = table.Column<long>(type: "bigint", nullable: false),
                    owner_module = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    workflow_name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    definition_snapshot_json = table.Column<string>(type: "jsonb", nullable: false),
                    input_json = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    active_node_ids_json = table.Column<string>(type: "jsonb", nullable: false),
                    completed_node_ids_json = table.Column<string>(type: "jsonb", nullable: false),
                    failed_node_id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    max_attempts = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    requested_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_by_subject = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    correlation_id = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    trace_id = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    error_code = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true),
                    error_detail = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workflow_runs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "workflow_run_steps",
                schema: "workflows",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    node_id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    node_kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    catalog_key = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    attempt = table.Column<int>(type: "integer", nullable: false),
                    output_json = table.Column<string>(type: "jsonb", nullable: true),
                    error_code = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true),
                    error_detail = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workflow_run_steps", x => x.id);
                    table.ForeignKey(
                        name: "fk_workflow_run_steps_workflow_runs_run_id",
                        column: x => x.run_id,
                        principalSchema: "workflows",
                        principalTable: "workflow_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_workflow_runs_owner_module_workflow_id_created_at",
                schema: "workflows",
                table: "workflow_runs",
                columns: new[] { "owner_module", "workflow_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_workflow_runs_status_next_attempt_at_created_at",
                schema: "workflows",
                table: "workflow_runs",
                columns: new[] { "status", "next_attempt_at", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_workflow_run_steps_run_id_created_at",
                schema: "workflows",
                table: "workflow_run_steps",
                columns: new[] { "run_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_workflow_run_steps_run_id_node_id_attempt",
                schema: "workflows",
                table: "workflow_run_steps",
                columns: new[] { "run_id", "node_id", "attempt" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "workflow_run_steps",
                schema: "workflows");

            migrationBuilder.DropTable(
                name: "workflow_runs",
                schema: "workflows");
        }
    }
}
