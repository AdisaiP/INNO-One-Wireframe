using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45LAgentRemoteConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "remote_consent_requests",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    operator_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    operator_role = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    mode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    message_th = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    message_en = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    requested_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    decided_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    decided_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_remote_consent_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_remote_consent_requests_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_remote_consent_requests_decided_by_user_id",
                schema: "devices",
                table: "remote_consent_requests",
                column: "decided_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_remote_consent_requests_device_id_status_expires_at",
                schema: "devices",
                table: "remote_consent_requests",
                columns: new[] { "device_id", "status", "expires_at" });

            migrationBuilder.CreateIndex(
                name: "ix_remote_consent_requests_requested_by_user_id",
                schema: "devices",
                table: "remote_consent_requests",
                column: "requested_by_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "remote_consent_requests",
                schema: "devices");
        }
    }
}
