using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Helpdesk.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step18HelpdeskSlaAutomation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "accumulated_paused_seconds",
                schema: "helpdesk",
                table: "ticket_sla",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "escalation_level",
                schema: "helpdesk",
                table: "ticket_sla",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "last_evaluated_at",
                schema: "helpdesk",
                table: "ticket_sla",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "paused_at",
                schema: "helpdesk",
                table: "ticket_sla",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "risk_emitted_at",
                schema: "helpdesk",
                table: "ticket_sla",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "applies_to",
                schema: "helpdesk",
                table: "sla_policies",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "business_calendar_id",
                schema: "helpdesk",
                table: "sla_policies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "escalation_levels_json",
                schema: "helpdesk",
                table: "sla_policies",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<bool>(
                name: "notify_requester_on_status_change",
                schema: "helpdesk",
                table: "sla_policies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "pause_on_requester_wait",
                schema: "helpdesk",
                table: "sla_policies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "reassign_on_breach",
                schema: "helpdesk",
                table: "sla_policies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "automation_rules",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    rule_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    trigger = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    scope_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    scope_value = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    condition_field = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    condition_operator = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    condition_value = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    action_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    action_value = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automation_rules", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "business_calendar",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    time_zone_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_business_calendar", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "automation_executions",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    rule_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket_id = table.Column<Guid>(type: "uuid", nullable: false),
                    trigger = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    result = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    detail_json = table.Column<string>(type: "jsonb", nullable: true),
                    executed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automation_executions", x => x.id);
                    table.ForeignKey(
                        name: "fk_automation_executions_automation_rules_rule_id",
                        column: x => x.rule_id,
                        principalSchema: "helpdesk",
                        principalTable: "automation_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_automation_executions_tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalSchema: "helpdesk",
                        principalTable: "tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "business_calendar_entries",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    calendar_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entry_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: true),
                    calendar_date = table.Column<DateOnly>(type: "date", nullable: true),
                    start_minute = table.Column<int>(type: "integer", nullable: true),
                    end_minute = table.Column<int>(type: "integer", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    is_working = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_business_calendar_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_business_calendar_entries_business_calendar_calendar_id",
                        column: x => x.calendar_id,
                        principalSchema: "helpdesk",
                        principalTable: "business_calendar",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_sla_policies_business_calendar_id",
                schema: "helpdesk",
                table: "sla_policies",
                column: "business_calendar_id");

            migrationBuilder.CreateIndex(
                name: "ix_automation_executions_executed_at_result",
                schema: "helpdesk",
                table: "automation_executions",
                columns: new[] { "executed_at", "result" });

            migrationBuilder.CreateIndex(
                name: "ix_automation_executions_rule_id_ticket_id_trigger",
                schema: "helpdesk",
                table: "automation_executions",
                columns: new[] { "rule_id", "ticket_id", "trigger" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_automation_executions_ticket_id",
                schema: "helpdesk",
                table: "automation_executions",
                column: "ticket_id");

            migrationBuilder.CreateIndex(
                name: "ix_automation_rules_code",
                schema: "helpdesk",
                table: "automation_rules",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_automation_rules_status_trigger_sort_order",
                schema: "helpdesk",
                table: "automation_rules",
                columns: new[] { "status", "trigger", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_business_calendar_code",
                schema: "helpdesk",
                table: "business_calendar",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_business_calendar_entries_calendar_id_entry_type_day_of_wee",
                schema: "helpdesk",
                table: "business_calendar_entries",
                columns: new[] { "calendar_id", "entry_type", "day_of_week", "calendar_date" });

            migrationBuilder.AddForeignKey(
                name: "fk_sla_policies_business_calendars_business_calendar_id",
                schema: "helpdesk",
                table: "sla_policies",
                column: "business_calendar_id",
                principalSchema: "helpdesk",
                principalTable: "business_calendar",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_sla_policies_business_calendars_business_calendar_id",
                schema: "helpdesk",
                table: "sla_policies");

            migrationBuilder.DropTable(
                name: "automation_executions",
                schema: "helpdesk");

            migrationBuilder.DropTable(
                name: "business_calendar_entries",
                schema: "helpdesk");

            migrationBuilder.DropTable(
                name: "automation_rules",
                schema: "helpdesk");

            migrationBuilder.DropTable(
                name: "business_calendar",
                schema: "helpdesk");

            migrationBuilder.DropIndex(
                name: "ix_sla_policies_business_calendar_id",
                schema: "helpdesk",
                table: "sla_policies");

            migrationBuilder.DropColumn(
                name: "accumulated_paused_seconds",
                schema: "helpdesk",
                table: "ticket_sla");

            migrationBuilder.DropColumn(
                name: "escalation_level",
                schema: "helpdesk",
                table: "ticket_sla");

            migrationBuilder.DropColumn(
                name: "last_evaluated_at",
                schema: "helpdesk",
                table: "ticket_sla");

            migrationBuilder.DropColumn(
                name: "paused_at",
                schema: "helpdesk",
                table: "ticket_sla");

            migrationBuilder.DropColumn(
                name: "risk_emitted_at",
                schema: "helpdesk",
                table: "ticket_sla");

            migrationBuilder.DropColumn(
                name: "applies_to",
                schema: "helpdesk",
                table: "sla_policies");

            migrationBuilder.DropColumn(
                name: "business_calendar_id",
                schema: "helpdesk",
                table: "sla_policies");

            migrationBuilder.DropColumn(
                name: "escalation_levels_json",
                schema: "helpdesk",
                table: "sla_policies");

            migrationBuilder.DropColumn(
                name: "notify_requester_on_status_change",
                schema: "helpdesk",
                table: "sla_policies");

            migrationBuilder.DropColumn(
                name: "pause_on_requester_wait",
                schema: "helpdesk",
                table: "sla_policies");

            migrationBuilder.DropColumn(
                name: "reassign_on_breach",
                schema: "helpdesk",
                table: "sla_policies");
        }
    }
}
