using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45VRemoteSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "remote_session_id",
                schema: "devices",
                table: "remote_consent_requests",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "remote_sessions",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    operator_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    consent_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    operation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    mode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    requested_duration_minutes = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    external_share_id = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    launch_url = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    requested_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ended_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    end_reason = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    failure_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_remote_sessions", x => x.id);
                    table.ForeignKey(
                        name: "fk_remote_sessions_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_remote_consent_requests_remote_session_id",
                schema: "devices",
                table: "remote_consent_requests",
                column: "remote_session_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_remote_sessions_consent_request_id",
                schema: "devices",
                table: "remote_sessions",
                column: "consent_request_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_remote_sessions_device_id_status_requested_at",
                schema: "devices",
                table: "remote_sessions",
                columns: new[] { "device_id", "status", "requested_at" });

            migrationBuilder.CreateIndex(
                name: "ix_remote_sessions_operator_user_id_requested_at",
                schema: "devices",
                table: "remote_sessions",
                columns: new[] { "operator_user_id", "requested_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "remote_sessions",
                schema: "devices");

            migrationBuilder.DropIndex(
                name: "ix_remote_consent_requests_remote_session_id",
                schema: "devices",
                table: "remote_consent_requests");

            migrationBuilder.DropColumn(
                name: "remote_session_id",
                schema: "devices",
                table: "remote_consent_requests");
        }
    }
}
