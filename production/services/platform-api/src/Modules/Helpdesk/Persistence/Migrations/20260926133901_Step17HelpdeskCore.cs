using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Helpdesk.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step17HelpdeskCore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "helpdesk");

            migrationBuilder.CreateTable(
                name: "categories",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    parent_category_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_categories", x => x.id);
                    table.ForeignKey(
                        name: "fk_categories_categories_parent_category_id",
                        column: x => x.parent_category_id,
                        principalSchema: "helpdesk",
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sla_policies",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    priority = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    response_minutes = table.Column<int>(type: "integer", nullable: false),
                    resolution_minutes = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sla_policies", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "statuses",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    is_closed = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_statuses", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tickets",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    subject = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    description = table.Column<string>(type: "character varying(12000)", maxLength: 12000, nullable: false),
                    requester_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requester_organization_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assignee_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assignee_team = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    category_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status_id = table.Column<Guid>(type: "uuid", nullable: false),
                    priority = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    impact = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    urgency = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    related_device_id = table.Column<Guid>(type: "uuid", nullable: true),
                    related_asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resolution_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tickets", x => x.id);
                    table.ForeignKey(
                        name: "fk_tickets_categories_category_id",
                        column: x => x.category_id,
                        principalSchema: "helpdesk",
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_tickets_statuses_status_id",
                        column: x => x.status_id,
                        principalSchema: "helpdesk",
                        principalTable: "statuses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ticket_assignments",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket_id = table.Column<Guid>(type: "uuid", nullable: false),
                    previous_assignee_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assignee_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    team = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    assigned_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ticket_assignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_ticket_assignments_tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalSchema: "helpdesk",
                        principalTable: "tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ticket_replies",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket_id = table.Column<Guid>(type: "uuid", nullable: false),
                    author_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    body = table.Column<string>(type: "character varying(12000)", maxLength: 12000, nullable: false),
                    visibility = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ticket_replies", x => x.id);
                    table.ForeignKey(
                        name: "fk_ticket_replies_tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalSchema: "helpdesk",
                        principalTable: "tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ticket_sla",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket_id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    response_due_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    resolution_due_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    response_met_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ticket_sla", x => x.id);
                    table.ForeignKey(
                        name: "fk_ticket_sla_sla_policies_policy_id",
                        column: x => x.policy_id,
                        principalSchema: "helpdesk",
                        principalTable: "sla_policies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_ticket_sla_tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalSchema: "helpdesk",
                        principalTable: "tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ticket_status_history",
                schema: "helpdesk",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_status_id = table.Column<Guid>(type: "uuid", nullable: true),
                    to_status_id = table.Column<Guid>(type: "uuid", nullable: false),
                    changed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    changed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ticket_status_history", x => x.id);
                    table.ForeignKey(
                        name: "fk_ticket_status_history_tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalSchema: "helpdesk",
                        principalTable: "tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_categories_code",
                schema: "helpdesk",
                table: "categories",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_categories_parent_category_id_status_sort_order",
                schema: "helpdesk",
                table: "categories",
                columns: new[] { "parent_category_id", "status", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_sla_policies_code",
                schema: "helpdesk",
                table: "sla_policies",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sla_policies_priority_is_active",
                schema: "helpdesk",
                table: "sla_policies",
                columns: new[] { "priority", "is_active" });

            migrationBuilder.CreateIndex(
                name: "ix_statuses_code",
                schema: "helpdesk",
                table: "statuses",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_ticket_assignments_ticket_id_assigned_at",
                schema: "helpdesk",
                table: "ticket_assignments",
                columns: new[] { "ticket_id", "assigned_at" });

            migrationBuilder.CreateIndex(
                name: "ix_ticket_replies_ticket_id_created_at",
                schema: "helpdesk",
                table: "ticket_replies",
                columns: new[] { "ticket_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_ticket_sla_policy_id",
                schema: "helpdesk",
                table: "ticket_sla",
                column: "policy_id");

            migrationBuilder.CreateIndex(
                name: "ix_ticket_sla_state_resolution_due_at",
                schema: "helpdesk",
                table: "ticket_sla",
                columns: new[] { "state", "resolution_due_at" });

            migrationBuilder.CreateIndex(
                name: "ix_ticket_sla_ticket_id",
                schema: "helpdesk",
                table: "ticket_sla",
                column: "ticket_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_ticket_status_history_ticket_id_changed_at",
                schema: "helpdesk",
                table: "ticket_status_history",
                columns: new[] { "ticket_id", "changed_at" });

            migrationBuilder.CreateIndex(
                name: "ix_tickets_assignee_user_id_status_id_updated_at",
                schema: "helpdesk",
                table: "tickets",
                columns: new[] { "assignee_user_id", "status_id", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "ix_tickets_category_id",
                schema: "helpdesk",
                table: "tickets",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ix_tickets_related_device_id",
                schema: "helpdesk",
                table: "tickets",
                column: "related_device_id");

            migrationBuilder.CreateIndex(
                name: "ix_tickets_requester_organization_unit_id",
                schema: "helpdesk",
                table: "tickets",
                column: "requester_organization_unit_id");

            migrationBuilder.CreateIndex(
                name: "ix_tickets_requester_user_id",
                schema: "helpdesk",
                table: "tickets",
                column: "requester_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_tickets_status_id_priority_created_at",
                schema: "helpdesk",
                table: "tickets",
                columns: new[] { "status_id", "priority", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_tickets_ticket_number",
                schema: "helpdesk",
                table: "tickets",
                column: "ticket_number",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ticket_assignments",
                schema: "helpdesk");

            migrationBuilder.DropTable(
                name: "ticket_replies",
                schema: "helpdesk");

            migrationBuilder.DropTable(
                name: "ticket_sla",
                schema: "helpdesk");

            migrationBuilder.DropTable(
                name: "ticket_status_history",
                schema: "helpdesk");

            migrationBuilder.DropTable(
                name: "sla_policies",
                schema: "helpdesk");

            migrationBuilder.DropTable(
                name: "tickets",
                schema: "helpdesk");

            migrationBuilder.DropTable(
                name: "categories",
                schema: "helpdesk");

            migrationBuilder.DropTable(
                name: "statuses",
                schema: "helpdesk");
        }
    }
}
