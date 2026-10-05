using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45LAgentPrompts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "agent_prompts",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_module = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    source_reference = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    prompt_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title_th = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    title_en = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    message_th = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    message_en = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    responded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    responded_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    response_key = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_agent_prompts", x => x.id);
                    table.ForeignKey(
                        name: "fk_agent_prompts_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_agent_prompts_device_id_status_expires_at",
                schema: "devices",
                table: "agent_prompts",
                columns: new[] { "device_id", "status", "expires_at" });

            migrationBuilder.CreateIndex(
                name: "ix_agent_prompts_source_module_source_reference",
                schema: "devices",
                table: "agent_prompts",
                columns: new[] { "source_module", "source_reference" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "agent_prompts",
                schema: "devices");
        }
    }
}
