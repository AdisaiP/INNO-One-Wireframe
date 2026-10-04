using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Workflows.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45CWorkflowPersistence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "workflows");

            migrationBuilder.CreateTable(
                name: "workflow_definitions",
                schema: "workflows",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    nodes_json = table.Column<string>(type: "jsonb", nullable: false),
                    edges_json = table.Column<string>(type: "jsonb", nullable: false),
                    orientation = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workflow_definitions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "workflow_definition_versions",
                schema: "workflows",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    nodes_json = table.Column<string>(type: "jsonb", nullable: false),
                    edges_json = table.Column<string>(type: "jsonb", nullable: false),
                    orientation = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    changed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workflow_definition_versions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_workflow_definitions_updated_at",
                schema: "workflows",
                table: "workflow_definitions",
                column: "updated_at");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_definition_versions_workflow_id_version",
                schema: "workflows",
                table: "workflow_definition_versions",
                columns: new[] { "workflow_id", "version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "workflow_definitions",
                schema: "workflows");

            migrationBuilder.DropTable(
                name: "workflow_definition_versions",
                schema: "workflows");
        }
    }
}
