using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step15IdentityAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "platform");

            migrationBuilder.CreateTable(
                name: "app_modules",
                schema: "platform",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    app_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    installed = table.Column<bool>(type: "boolean", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_app_modules", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "locations",
                schema: "platform",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    parent_location_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_locations", x => x.id);
                    table.ForeignKey(
                        name: "fk_locations_locations_parent_location_id",
                        column: x => x.parent_location_id,
                        principalSchema: "platform",
                        principalTable: "locations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "organization_units",
                schema: "platform",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    parent_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_organization_units", x => x.id);
                    table.ForeignKey(
                        name: "fk_organization_units_organization_units_parent_unit_id",
                        column: x => x.parent_unit_id,
                        principalSchema: "platform",
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "permissions",
                schema: "platform",
                columns: table => new
                {
                    permission_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    module = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_permissions", x => x.permission_id);
                });

            migrationBuilder.CreateTable(
                name: "positions",
                schema: "platform",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_positions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                schema: "platform",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_profiles",
                schema: "platform",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    keycloak_subject = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    employee_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    full_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    organization_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    position_id = table.Column<Guid>(type: "uuid", nullable: true),
                    location_id = table.Column<Guid>(type: "uuid", nullable: true),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    phone = table.Column<string>(type: "text", nullable: true),
                    office = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_profiles", x => x.id);
                    table.ForeignKey(
                        name: "fk_user_profiles_locations_location_id",
                        column: x => x.location_id,
                        principalSchema: "platform",
                        principalTable: "locations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_user_profiles_organization_units_organization_unit_id",
                        column: x => x.organization_unit_id,
                        principalSchema: "platform",
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_user_profiles_positions_position_id",
                        column: x => x.position_id,
                        principalSchema: "platform",
                        principalTable: "positions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "access_assignments",
                schema: "platform",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    subject_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    subject_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    scope_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    include_children = table.Column<bool>(type: "boolean", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_access_assignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_access_assignments_roles_role_id",
                        column: x => x.role_id,
                        principalSchema: "platform",
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "role_permissions",
                schema: "platform",
                columns: table => new
                {
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    permission_id = table.Column<string>(type: "character varying(128)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_role_permissions", x => new { x.role_id, x.permission_id });
                    table.ForeignKey(
                        name: "fk_role_permissions_permissions_permission_id",
                        column: x => x.permission_id,
                        principalSchema: "platform",
                        principalTable: "permissions",
                        principalColumn: "permission_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_role_permissions_roles_role_id",
                        column: x => x.role_id,
                        principalSchema: "platform",
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "access_assignment_actions",
                schema: "platform",
                columns: table => new
                {
                    assignment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    permission_id = table.Column<string>(type: "character varying(128)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_access_assignment_actions", x => new { x.assignment_id, x.permission_id });
                    table.ForeignKey(
                        name: "fk_access_assignment_actions_access_assignments_assignment_id",
                        column: x => x.assignment_id,
                        principalSchema: "platform",
                        principalTable: "access_assignments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_access_assignment_actions_permissions_permission_id",
                        column: x => x.permission_id,
                        principalSchema: "platform",
                        principalTable: "permissions",
                        principalColumn: "permission_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "access_assignment_resources",
                schema: "platform",
                columns: table => new
                {
                    assignment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    resource_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    resource_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_access_assignment_resources", x => new { x.assignment_id, x.resource_type, x.resource_id });
                    table.ForeignKey(
                        name: "fk_access_assignment_resources_access_assignments_assignment_id",
                        column: x => x.assignment_id,
                        principalSchema: "platform",
                        principalTable: "access_assignments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_access_assignment_actions_permission_id",
                schema: "platform",
                table: "access_assignment_actions",
                column: "permission_id");

            migrationBuilder.CreateIndex(
                name: "ix_access_assignments_role_id",
                schema: "platform",
                table: "access_assignments",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "ix_access_assignments_subject_type_subject_id_status",
                schema: "platform",
                table: "access_assignments",
                columns: new[] { "subject_type", "subject_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_app_modules_app_id",
                schema: "platform",
                table: "app_modules",
                column: "app_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_locations_code",
                schema: "platform",
                table: "locations",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_locations_parent_location_id",
                schema: "platform",
                table: "locations",
                column: "parent_location_id");

            migrationBuilder.CreateIndex(
                name: "ix_organization_units_code",
                schema: "platform",
                table: "organization_units",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_organization_units_parent_unit_id_status",
                schema: "platform",
                table: "organization_units",
                columns: new[] { "parent_unit_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_positions_code",
                schema: "platform",
                table: "positions",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_role_permissions_permission_id",
                schema: "platform",
                table: "role_permissions",
                column: "permission_id");

            migrationBuilder.CreateIndex(
                name: "ix_roles_code",
                schema: "platform",
                table: "roles",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_profiles_employee_id",
                schema: "platform",
                table: "user_profiles",
                column: "employee_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_profiles_keycloak_subject",
                schema: "platform",
                table: "user_profiles",
                column: "keycloak_subject",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_profiles_location_id",
                schema: "platform",
                table: "user_profiles",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "ix_user_profiles_organization_unit_id",
                schema: "platform",
                table: "user_profiles",
                column: "organization_unit_id");

            migrationBuilder.CreateIndex(
                name: "ix_user_profiles_position_id",
                schema: "platform",
                table: "user_profiles",
                column: "position_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "access_assignment_actions",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "access_assignment_resources",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "app_modules",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "role_permissions",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "user_profiles",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "access_assignments",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "permissions",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "locations",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "organization_units",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "positions",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "roles",
                schema: "platform");
        }
    }
}
