using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Devices.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45XPoliciesAlertsOverview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "alert_channels",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    channel_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    configuration_json = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_alert_channels", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "device_alert_rules",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    rule_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    severity = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    scope_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    scope_id = table.Column<Guid>(type: "uuid", nullable: true),
                    configuration_json = table.Column<string>(type: "jsonb", nullable: false),
                    channels_json = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_alert_rules", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "endpoint_policies",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    policy_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    configuration_json = table.Column<string>(type: "jsonb", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_endpoint_policies", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "device_alerts",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    rule_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: true),
                    device_group_id = table.Column<Guid>(type: "uuid", nullable: true),
                    fingerprint = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    severity = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    detail = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    detected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_observed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    acknowledged_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    acknowledged_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_alerts", x => x.id);
                    table.ForeignKey(
                        name: "fk_device_alerts_device_alert_rules_rule_id",
                        column: x => x.rule_id,
                        principalSchema: "devices",
                        principalTable: "device_alert_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_device_alerts_device_groups_device_group_id",
                        column: x => x.device_group_id,
                        principalSchema: "devices",
                        principalTable: "device_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_device_alerts_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "policy_assignments",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    scope_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    scope_id = table.Column<Guid>(type: "uuid", nullable: true),
                    scope_label = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_policy_assignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_policy_assignments_endpoint_policies_policy_id",
                        column: x => x.policy_id,
                        principalSchema: "devices",
                        principalTable: "endpoint_policies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "policy_compliance",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    expected_value = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    actual_value = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    evidence_source = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    evaluated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_policy_compliance", x => x.id);
                    table.ForeignKey(
                        name: "fk_policy_compliance_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "devices",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_policy_compliance_endpoint_policies_policy_id",
                        column: x => x.policy_id,
                        principalSchema: "devices",
                        principalTable: "endpoint_policies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "alert_delivery_history",
                schema: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    alert_id = table.Column<Guid>(type: "uuid", nullable: false),
                    channel_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    delivery_status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    recipient_summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    detail = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    attempted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_alert_delivery_history", x => x.id);
                    table.ForeignKey(
                        name: "fk_alert_delivery_history_device_alerts_alert_id",
                        column: x => x.alert_id,
                        principalSchema: "devices",
                        principalTable: "device_alerts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_alert_channels_channel_type",
                schema: "devices",
                table: "alert_channels",
                column: "channel_type",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_alert_delivery_history_alert_id_attempted_at",
                schema: "devices",
                table: "alert_delivery_history",
                columns: new[] { "alert_id", "attempted_at" });

            migrationBuilder.CreateIndex(
                name: "ix_alert_delivery_history_channel_type_delivery_status_attempt",
                schema: "devices",
                table: "alert_delivery_history",
                columns: new[] { "channel_type", "delivery_status", "attempted_at" });

            migrationBuilder.CreateIndex(
                name: "ix_device_alert_rules_code",
                schema: "devices",
                table: "device_alert_rules",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_device_alert_rules_scope_type_scope_id",
                schema: "devices",
                table: "device_alert_rules",
                columns: new[] { "scope_type", "scope_id" });

            migrationBuilder.CreateIndex(
                name: "ix_device_alert_rules_status_rule_type",
                schema: "devices",
                table: "device_alert_rules",
                columns: new[] { "status", "rule_type" });

            migrationBuilder.CreateIndex(
                name: "ix_device_alerts_device_group_id",
                schema: "devices",
                table: "device_alerts",
                column: "device_group_id");

            migrationBuilder.CreateIndex(
                name: "ix_device_alerts_device_id",
                schema: "devices",
                table: "device_alerts",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "ix_device_alerts_fingerprint",
                schema: "devices",
                table: "device_alerts",
                column: "fingerprint",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_device_alerts_rule_id",
                schema: "devices",
                table: "device_alerts",
                column: "rule_id");

            migrationBuilder.CreateIndex(
                name: "ix_device_alerts_status_severity_detected_at",
                schema: "devices",
                table: "device_alerts",
                columns: new[] { "status", "severity", "detected_at" });

            migrationBuilder.CreateIndex(
                name: "ix_endpoint_policies_code",
                schema: "devices",
                table: "endpoint_policies",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_endpoint_policies_status_policy_type",
                schema: "devices",
                table: "endpoint_policies",
                columns: new[] { "status", "policy_type" });

            migrationBuilder.CreateIndex(
                name: "ix_policy_assignments_policy_id_scope_type_scope_id",
                schema: "devices",
                table: "policy_assignments",
                columns: new[] { "policy_id", "scope_type", "scope_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_policy_assignments_scope_type_scope_id",
                schema: "devices",
                table: "policy_assignments",
                columns: new[] { "scope_type", "scope_id" });

            migrationBuilder.CreateIndex(
                name: "ix_policy_compliance_device_id",
                schema: "devices",
                table: "policy_compliance",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "ix_policy_compliance_policy_id_device_id",
                schema: "devices",
                table: "policy_compliance",
                columns: new[] { "policy_id", "device_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_policy_compliance_status_evaluated_at",
                schema: "devices",
                table: "policy_compliance",
                columns: new[] { "status", "evaluated_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "alert_channels",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "alert_delivery_history",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "policy_assignments",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "policy_compliance",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "device_alerts",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "endpoint_policies",
                schema: "devices");

            migrationBuilder.DropTable(
                name: "device_alert_rules",
                schema: "devices");
        }
    }
}
