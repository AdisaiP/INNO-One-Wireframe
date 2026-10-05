using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Reports.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45KReportsProductSlice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "reports");

            migrationBuilder.CreateTable(
                name: "report_definitions",
                schema: "reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    description = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    source_key = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    columns_json = table.Column<string>(type: "jsonb", nullable: false),
                    filters_json = table.Column<string>(type: "jsonb", nullable: false),
                    output_format = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_subject = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_report_definitions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "report_runs",
                schema: "reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    report_id = table.Column<Guid>(type: "uuid", nullable: false),
                    report_version = table.Column<long>(type: "bigint", nullable: false),
                    report_name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    definition_snapshot_json = table.Column<string>(type: "jsonb", nullable: false),
                    trigger = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    row_count = table.Column<int>(type: "integer", nullable: false),
                    output_file_name = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    output_mime_type = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    output_text = table.Column<string>(type: "text", nullable: true),
                    error_code = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    error_detail = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    requested_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_by_subject = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    correlation_id = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    trace_id = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_report_runs", x => x.id);
                    table.ForeignKey(
                        name: "fk_report_runs_report_definitions_report_id",
                        column: x => x.report_id,
                        principalSchema: "reports",
                        principalTable: "report_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "report_schedules",
                schema: "reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    report_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    cadence = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    time_zone_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    hour = table.Column<int>(type: "integer", nullable: false),
                    minute = table.Column<int>(type: "integer", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: true),
                    day_of_month = table.Column<int>(type: "integer", nullable: true),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    next_run_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_run_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_run_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_subject = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_report_schedules", x => x.id);
                    table.ForeignKey(
                        name: "fk_report_schedules_report_definitions_report_id",
                        column: x => x.report_id,
                        principalSchema: "reports",
                        principalTable: "report_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_report_definitions_status_updated_at",
                schema: "reports",
                table: "report_definitions",
                columns: new[] { "status", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "ix_report_runs_report_id_created_at",
                schema: "reports",
                table: "report_runs",
                columns: new[] { "report_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_report_runs_status_created_at",
                schema: "reports",
                table: "report_runs",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_report_schedules_is_enabled_next_run_at",
                schema: "reports",
                table: "report_schedules",
                columns: new[] { "is_enabled", "next_run_at" });

            migrationBuilder.CreateIndex(
                name: "ix_report_schedules_report_id_name",
                schema: "reports",
                table: "report_schedules",
                columns: new[] { "report_id", "name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "report_runs",
                schema: "reports");

            migrationBuilder.DropTable(
                name: "report_schedules",
                schema: "reports");

            migrationBuilder.DropTable(
                name: "report_definitions",
                schema: "reports");
        }
    }
}
