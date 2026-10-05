using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Workflows.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45NWorkflowOwnershipCleanup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM workflows.workflow_runs
                WHERE owner_module = 'legacy_unassigned';

                DELETE FROM workflows.workflow_definition_versions
                WHERE owner_module = 'legacy_unassigned';

                DELETE FROM workflows.workflow_definitions
                WHERE owner_module = 'legacy_unassigned';
                """);

            migrationBuilder.AlterColumn<string>(
                name: "owner_module",
                schema: "workflows",
                table: "workflow_definition_versions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64,
                oldDefaultValue: "legacy_unassigned");

            migrationBuilder.AlterColumn<string>(
                name: "owner_module",
                schema: "workflows",
                table: "workflow_definitions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64,
                oldDefaultValue: "legacy_unassigned");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "owner_module",
                schema: "workflows",
                table: "workflow_definition_versions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "legacy_unassigned",
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64);

            migrationBuilder.AlterColumn<string>(
                name: "owner_module",
                schema: "workflows",
                table: "workflow_definitions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "legacy_unassigned",
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64);
        }
    }
}
