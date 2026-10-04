using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Workflows.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45FHelpdeskAutomationOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_workflow_definitions_updated_at",
                schema: "workflows",
                table: "workflow_definitions");

            migrationBuilder.AddColumn<string>(
                name: "owner_module",
                schema: "workflows",
                table: "workflow_definition_versions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "legacy_unassigned");

            migrationBuilder.AddColumn<string>(
                name: "owner_module",
                schema: "workflows",
                table: "workflow_definitions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "legacy_unassigned");

            // Preserve existing Step18 simple rules as Helpdesk-owned visual definitions.
            // On new installations the old Helpdesk seed no longer creates these rules.
            migrationBuilder.Sql("""
                INSERT INTO workflows.workflow_definitions
                    (id, owner_module, name, nodes_json, edges_json, orientation, status,
                     version, created_by_user_id, updated_by_user_id, created_at, updated_at)
                SELECT
                    r.id,
                    'helpdesk',
                    LEFT(r.name, 180),
                    jsonb_build_array(
                        jsonb_build_object(
                            'id', 'trigger',
                            'kind', 'trigger',
                            'catalogKey', CASE r.trigger
                                WHEN 'ticket_created' THEN 'helpdesk.ticket.created'
                                WHEN 'ticket_updated' THEN 'helpdesk.ticket.updated'
                                WHEN 'sla_at_risk' THEN 'helpdesk.sla.at_risk'
                                WHEN 'status_changed' THEN 'helpdesk.ticket.status_changed'
                                ELSE 'helpdesk.ticket.updated'
                            END,
                            'label', CASE r.trigger
                                WHEN 'ticket_created' THEN 'Ticket Created'
                                WHEN 'ticket_updated' THEN 'Ticket Updated'
                                WHEN 'sla_at_risk' THEN 'SLA At Risk'
                                WHEN 'status_changed' THEN 'Status Changed'
                                ELSE 'Ticket Updated'
                            END,
                            'labelKey', CASE r.trigger
                                WHEN 'ticket_created' THEN 'helpdesk.automation.catalog.ticketCreated.label'
                                WHEN 'ticket_updated' THEN 'helpdesk.automation.catalog.ticketUpdated.label'
                                WHEN 'sla_at_risk' THEN 'helpdesk.automation.catalog.slaAtRisk.label'
                                WHEN 'status_changed' THEN 'helpdesk.automation.catalog.statusChanged.label'
                                ELSE 'helpdesk.automation.catalog.ticketUpdated.label'
                            END,
                            'descriptionKey', CASE r.trigger
                                WHEN 'ticket_created' THEN 'helpdesk.automation.catalog.ticketCreated.description'
                                WHEN 'ticket_updated' THEN 'helpdesk.automation.catalog.ticketUpdated.description'
                                WHEN 'sla_at_risk' THEN 'helpdesk.automation.catalog.slaAtRisk.description'
                                WHEN 'status_changed' THEN 'helpdesk.automation.catalog.statusChanged.description'
                                ELSE 'helpdesk.automation.catalog.ticketUpdated.description'
                            END,
                            'description', 'Migrated from the legacy Helpdesk automation rule.',
                            'configuration', jsonb_build_object(
                                'legacyRuleId', r.id::text,
                                'legacyCode', r.code,
                                'legacyStatus', r.status,
                                'legacySortOrder', r.sort_order,
                                'legacyTrigger', r.trigger
                            )
                        ),
                        jsonb_build_object(
                            'id', 'condition',
                            'kind', 'condition',
                            'catalogKey', 'helpdesk.ticket.condition',
                            'label', 'Ticket Condition',
                            'labelKey', 'helpdesk.automation.catalog.ticketCondition.label',
                            'descriptionKey', 'helpdesk.automation.catalog.ticketCondition.description',
                            'description', 'Checks the migrated legacy scope and condition.',
                            'configuration', jsonb_build_object(
                                'scopeType', r.scope_type,
                                'scopeValue', r.scope_value,
                                'field', r.condition_field,
                                'operator', r.condition_operator,
                                'value', r.condition_value
                            )
                        ),
                        jsonb_build_object(
                            'id', 'action',
                            'kind', CASE r.action_type
                                WHEN 'assign_team' THEN 'assignment'
                                ELSE 'action'
                            END,
                            'catalogKey', CASE r.action_type
                                WHEN 'assign_team' THEN 'helpdesk.ticket.assign_team'
                                WHEN 'escalate_manager_chain' THEN 'helpdesk.ticket.escalate'
                                ELSE 'helpdesk.ticket.update'
                            END,
                            'label', CASE r.action_type
                                WHEN 'assign_team' THEN 'Assign Team'
                                WHEN 'escalate_manager_chain' THEN 'Escalate Ticket'
                                ELSE 'Update Ticket'
                            END,
                            'labelKey', CASE r.action_type
                                WHEN 'assign_team' THEN 'helpdesk.automation.catalog.assignTeam.label'
                                WHEN 'escalate_manager_chain' THEN 'helpdesk.automation.catalog.escalateTicket.label'
                                ELSE 'helpdesk.automation.catalog.updateTicket.label'
                            END,
                            'descriptionKey', CASE r.action_type
                                WHEN 'assign_team' THEN 'helpdesk.automation.catalog.assignTeam.description'
                                WHEN 'escalate_manager_chain' THEN 'helpdesk.automation.catalog.escalateTicket.description'
                                ELSE 'helpdesk.automation.catalog.updateTicket.description'
                            END,
                            'description', 'Migrated from the legacy Helpdesk automation action.',
                            'configuration', jsonb_build_object(
                                'actionType', r.action_type,
                                'actionValue', r.action_value
                            )
                        ),
                        jsonb_build_object(
                            'id', 'end',
                            'kind', 'end',
                            'catalogKey', 'workflow.end',
                            'label', 'End',
                            'labelKey', 'helpdesk.automation.catalog.end.label',
                            'descriptionKey', 'helpdesk.automation.catalog.end.description',
                            'configuration', jsonb_build_object()
                        )
                    ),
                    jsonb_build_array(
                        jsonb_build_object('id', 'edge_trigger_condition', 'source', 'trigger', 'target', 'condition'),
                        jsonb_build_object('id', 'edge_condition_action', 'source', 'condition', 'target', 'action'),
                        jsonb_build_object('id', 'edge_action_end', 'source', 'action', 'target', 'end')
                    ),
                    'horizontal',
                    'draft',
                    1,
                    '00000000-0000-0000-0000-000000000000'::uuid,
                    '00000000-0000-0000-0000-000000000000'::uuid,
                    r.created_at,
                    r.updated_at
                FROM helpdesk.automation_rules r
                ON CONFLICT (id) DO NOTHING;

                INSERT INTO workflows.workflow_definition_versions
                    (id, workflow_id, version, owner_module, name, nodes_json, edges_json,
                     orientation, status, changed_by_user_id, created_at)
                SELECT
                    d.id,
                    d.id,
                    d.version,
                    d.owner_module,
                    d.name,
                    d.nodes_json,
                    d.edges_json,
                    d.orientation,
                    d.status,
                    d.updated_by_user_id,
                    d.updated_at
                FROM workflows.workflow_definitions d
                INNER JOIN helpdesk.automation_rules r ON r.id = d.id
                WHERE d.owner_module = 'helpdesk'
                ON CONFLICT DO NOTHING;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_workflow_definitions_owner_module_updated_at",
                schema: "workflows",
                table: "workflow_definitions",
                columns: new[] { "owner_module", "updated_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_workflow_definitions_owner_module_updated_at",
                schema: "workflows",
                table: "workflow_definitions");

            migrationBuilder.DropColumn(
                name: "owner_module",
                schema: "workflows",
                table: "workflow_definition_versions");

            migrationBuilder.DropColumn(
                name: "owner_module",
                schema: "workflows",
                table: "workflow_definitions");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_definitions_updated_at",
                schema: "workflows",
                table: "workflow_definitions",
                column: "updated_at");
        }
    }
}
