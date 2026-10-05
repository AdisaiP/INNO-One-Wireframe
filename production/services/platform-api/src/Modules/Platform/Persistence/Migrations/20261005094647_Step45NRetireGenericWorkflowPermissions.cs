using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45NRetireGenericWorkflowPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM platform.access_assignment_actions
                WHERE permission_id IN ('workflows.view', 'workflows.manage');

                DELETE FROM platform.role_permissions
                WHERE permission_id IN ('workflows.view', 'workflows.manage');

                DELETE FROM platform.permissions
                WHERE permission_id IN ('workflows.view', 'workflows.manage');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Retired permission assignments are intentionally not recreated.
        }
    }
}
