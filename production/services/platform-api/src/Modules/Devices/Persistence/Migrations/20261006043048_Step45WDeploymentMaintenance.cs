using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45WDeploymentMaintenance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "agent_rollouts",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    operation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rollout_number = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    release_version = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    target_scope_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    target_scope_id = table.Column<Guid>(type: "uuid", nullable: true),
                    target_definition_json = table.Column<string>(type: "jsonb", nullable: false),
                    target_label = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    maintenance_window = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    retry_attempts = table.Column<int>(type: "integer", nullable: false),
                    pause_failure_threshold_percent = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    target_count = table.Column<int>(type: "integer", nullable: false),
                    completed_count = table.Column<int>(type: "integer", nullable: false),
                    failed_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_agent_rollouts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "deployment_jobs",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    operation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_number = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    deployment_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    target_scope_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    target_scope_id = table.Column<Guid>(type: "uuid", nullable: true),
                    target_definition_json = table.Column<string>(type: "jsonb", nullable: false),
                    target_label = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    payload_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    profile_or_destination = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    schedule_mode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    scheduled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    maintenance_window = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    retry_attempts = table.Column<int>(type: "integer", nullable: false),
                    restart_policy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    target_count = table.Column<int>(type: "integer", nullable: false),
                    completed_count = table.Column<int>(type: "integer", nullable: false),
                    failed_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_deployment_jobs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "maintenance_jobs",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    operation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_number = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    maintenance_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    package_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    target_scope_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    target_scope_id = table.Column<Guid>(type: "uuid", nullable: true),
                    target_definition_json = table.Column<string>(type: "jsonb", nullable: false),
                    target_label = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    schedule_mode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    scheduled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    maintenance_window = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    retry_attempts = table.Column<int>(type: "integer", nullable: false),
                    restart_policy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    grace_minutes = table.Column<int>(type: "integer", nullable: true),
                    user_message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    offline_policy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    target_count = table.Column<int>(type: "integer", nullable: false),
                    completed_count = table.Column<int>(type: "integer", nullable: false),
                    failed_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_maintenance_jobs", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_agent_rollouts_operation_id",
                schema: "devices",
                table: "agent_rollouts",
                column: "operation_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_agent_rollouts_rollout_number",
                schema: "devices",
                table: "agent_rollouts",
                column: "rollout_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_agent_rollouts_status_created_at",
                schema: "devices",
                table: "agent_rollouts",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_agent_rollouts_target_scope_type_target_scope_id",
                schema: "devices",
                table: "agent_rollouts",
                columns: new[] { "target_scope_type", "target_scope_id" });

            migrationBuilder.CreateIndex(
                name: "ix_deployment_jobs_job_number",
                schema: "devices",
                table: "deployment_jobs",
                column: "job_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_deployment_jobs_operation_id",
                schema: "devices",
                table: "deployment_jobs",
                column: "operation_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_deployment_jobs_status_created_at",
                schema: "devices",
                table: "deployment_jobs",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_deployment_jobs_target_scope_type_target_scope_id",
                schema: "devices",
                table: "deployment_jobs",
                columns: new[] { "target_scope_type", "target_scope_id" });

            migrationBuilder.CreateIndex(
                name: "ix_maintenance_jobs_job_number",
                schema: "devices",
                table: "maintenance_jobs",
                column: "job_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_maintenance_jobs_maintenance_type_status_created_at",
                schema: "devices",
                table: "maintenance_jobs",
                columns: new[] { "maintenance_type", "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_maintenance_jobs_operation_id",
                schema: "devices",
                table: "maintenance_jobs",
                column: "operation_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_maintenance_jobs_target_scope_type_target_scope_id",
                schema: "devices",
                table: "maintenance_jobs",
                columns: new[] { "target_scope_type", "target_scope_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "agent_rollouts",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "deployment_jobs",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "maintenance_jobs",
                schema: "devices");
        }
    }
}
