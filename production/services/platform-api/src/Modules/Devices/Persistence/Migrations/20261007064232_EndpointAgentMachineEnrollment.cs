using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EndpointAgentMachineEnrollment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "device_agent_credentials",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    secret_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    enrolled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_authenticated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_agent_credentials", x => x.id);
                    table.ForeignKey(
                        name: "fk_device_agent_credentials_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "device_enrollment_tokens",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: true),
                    intended_owner_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    used_by_device_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_enrollment_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_device_enrollment_tokens_device_groups_group_id",
                        column: x => x.group_id,
                        principalSchema: "devices",
                        principalTable: "device_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_device_enrollment_tokens_devices_used_by_device_id",
                        column: x => x.used_by_device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "device_ownership_suggestions",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    detected_identity = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    detected_upn = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    match_reason = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    confirmed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    confirmed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_ownership_suggestions", x => x.id);
                    table.ForeignKey(
                        name: "fk_device_ownership_suggestions_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_device_agent_credentials_device_id",
                schema: "devices",
                table: "device_agent_credentials",
                column: "device_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_device_enrollment_tokens_group_id",
                schema: "devices",
                table: "device_enrollment_tokens",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "ix_device_enrollment_tokens_status_expires_at",
                schema: "devices",
                table: "device_enrollment_tokens",
                columns: new[] { "status", "expires_at" });

            migrationBuilder.CreateIndex(
                name: "ix_device_enrollment_tokens_token_hash",
                schema: "devices",
                table: "device_enrollment_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_device_enrollment_tokens_used_by_device_id",
                schema: "devices",
                table: "device_enrollment_tokens",
                column: "used_by_device_id");

            migrationBuilder.CreateIndex(
                name: "ix_device_ownership_suggestions_device_id",
                schema: "devices",
                table: "device_ownership_suggestions",
                column: "device_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_device_ownership_suggestions_status_candidate_user_id",
                schema: "devices",
                table: "device_ownership_suggestions",
                columns: new[] { "status", "candidate_user_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "device_agent_credentials",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "device_enrollment_tokens",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "device_ownership_suggestions",
                schema: "devices");
        }
    }
}
