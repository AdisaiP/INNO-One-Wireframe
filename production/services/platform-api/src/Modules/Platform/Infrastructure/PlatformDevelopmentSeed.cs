using INNO.One.Modules.Platform.Domain;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Infrastructure;

public static class PlatformDevelopmentSeed
{
    public static readonly Guid UserId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    public static readonly Guid HrViewerUserId = Guid.Parse("10000000-0000-0000-0000-000000000002");
    public static readonly Guid SupportAgentUserId = Guid.Parse("10000000-0000-0000-0000-000000000003");
    public static readonly Guid SomchaiUserId = Guid.Parse("10000000-0000-0000-0000-000000000004");

    public static readonly Guid RootOrganizationId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    public static readonly Guid DigitalTechnologyId = Guid.Parse("20000000-0000-0000-0000-000000000002");
    public static readonly Guid HumanResourcesId = Guid.Parse("20000000-0000-0000-0000-000000000003");
    public static readonly Guid FinanceId = Guid.Parse("20000000-0000-0000-0000-000000000004");
    public static readonly Guid BangkokLocationId = Guid.Parse("30000000-0000-0000-0000-000000000001");

    public static readonly Guid ProgrammerPositionId = Guid.Parse("40000000-0000-0000-0000-000000000001");
    public static readonly Guid HrOfficerPositionId = Guid.Parse("40000000-0000-0000-0000-000000000002");
    public static readonly Guid SupportPositionId = Guid.Parse("40000000-0000-0000-0000-000000000003");

    public static readonly Guid PlatformAdminRoleId = Guid.Parse("50000000-0000-0000-0000-000000000001");
    public static readonly Guid DeviceViewerRoleId = Guid.Parse("50000000-0000-0000-0000-000000000002");
    public static readonly Guid SupportAgentRoleId = Guid.Parse("50000000-0000-0000-0000-000000000003");
    public static readonly Guid EmployeeHelpdeskRoleId = Guid.Parse("50000000-0000-0000-0000-000000000004");

    public static readonly Guid AssignmentId = Guid.Parse("60000000-0000-0000-0000-000000000001");
    public static readonly Guid HrAssignmentId = Guid.Parse("60000000-0000-0000-0000-000000000002");
    public static readonly Guid SupportAssignmentId = Guid.Parse("60000000-0000-0000-0000-000000000003");
    public static readonly Guid SomchaiAssignmentId = Guid.Parse("60000000-0000-0000-0000-000000000004");

    public const string KeycloakSubject = "11111111-1111-1111-1111-111111111111";
    public const string HrViewerKeycloakSubject = "22222222-2222-2222-2222-222222222222";

    private static readonly (string Id, string Module, string Name)[] Step17Permissions =
    [
        ("helpdesk.ticket.view", "helpdesk", "View helpdesk tickets"),
        ("helpdesk.ticket.create", "helpdesk", "Create helpdesk tickets"),
        ("helpdesk.ticket.reply", "helpdesk", "Reply to helpdesk tickets"),
        ("helpdesk.ticket.assign", "helpdesk", "Assign helpdesk tickets"),
        ("helpdesk.ticket.resolve", "helpdesk", "Resolve helpdesk tickets"),
        ("helpdesk.sla.manage", "helpdesk", "Manage helpdesk SLA"),
        ("helpdesk.catalog.manage", "helpdesk", "Manage helpdesk categories"),
        ("helpdesk.status.manage", "helpdesk", "Manage helpdesk statuses")
    ];

    private static readonly (string Id, string Module, string Name)[] Step18Permissions =
    [
        ("helpdesk.automation.view", "helpdesk", "View helpdesk automation"),
        ("helpdesk.automation.manage", "helpdesk", "Manage helpdesk automation")
    ];

    private static readonly (string Id, string Module, string Name)[] Step19Permissions =
    [
        ("assets.view", "assets", "View assets"),
        ("assets.manage", "assets", "Manage assets")
    ];

    private static readonly (string Id, string Module, string Name)[] Step21Permissions =
    [
        ("assets.qr.print", "assets", "Generate and print asset QR labels"),
        ("assets.qr.scan", "assets", "Resolve asset QR labels")
    ];

    private static readonly (string Id, string Module, string Name)[] Step22Permissions =
    [
        ("assets.license.manage", "assets", "Manage software license compliance")
    ];

    private static readonly (string Id, string Module, string Name)[] Step23Permissions =
    [
        ("assets.contract.manage", "assets", "Manage contracts and warranty")
    ];

    private static readonly (string Id, string Module, string Name)[] Step26Permissions =
    [
        ("assets.baseline.manage", "assets", "Manage software baseline definitions")
    ];

    private static readonly (string Id, string Module, string Name)[] Step30Permissions =
    [
        ("platform.apps.view", "platform", "View available applications"),
        ("admin.apps.view", "admin", "View Apps & Modules administration"),
        ("admin.apps.manage", "admin", "Enable or disable installed applications")
    ];

    private static readonly (string Id, string Module, string Name)[] Step31Permissions =
    [
        ("admin.access", "admin", "Access Admin Center"),
        ("admin.organization.view", "admin", "View organization structure"),
        ("admin.organization.manage", "admin", "Manage organization structure"),
        ("admin.locations.view", "admin", "View locations"),
        ("admin.locations.manage", "admin", "Manage locations"),
        ("admin.positions.view", "admin", "View positions"),
        ("admin.positions.manage", "admin", "Manage positions"),
        ("admin.users.view", "admin", "View users"),
        ("admin.users.manage", "admin", "Manage users"),
        ("admin.roles.view", "admin", "View roles and permissions"),
        ("admin.roles.manage", "admin", "Manage roles and permissions"),
        ("admin.access_scopes.view", "admin", "View access scopes"),
        ("admin.access_scopes.manage", "admin", "Manage access scopes"),
        ("admin.access_scopes.evaluate", "admin", "Evaluate effective access")
    ];

    private static readonly (string Id, string Module, string Name)[] Step32Permissions =
    [
        ("admin.integrations.view", "admin", "View platform integrations"),
        ("admin.integrations.manage", "admin", "Test platform integrations")
    ];

    public static async Task SeedAsync(
        PlatformDbContext db,
        CancellationToken cancellationToken = default)
    {
        if (await db.UserProfiles.AnyAsync(cancellationToken))
        {
            await EnsureStep16To23Async(db, cancellationToken);
            return;
        }

        var now = DateTimeOffset.UtcNow;

        db.OrganizationUnits.AddRange(
            new OrganizationUnit
            {
                Id = RootOrganizationId,
                Code = "ISS",
                Name = "Innovations Solutions and Service",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new OrganizationUnit
            {
                Id = DigitalTechnologyId,
                Code = "DTD",
                Name = "Digital Technology",
                ParentUnitId = RootOrganizationId,
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new OrganizationUnit
            {
                Id = HumanResourcesId,
                Code = "HR",
                Name = "Human Resources",
                ParentUnitId = RootOrganizationId,
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new OrganizationUnit
            {
                Id = FinanceId,
                Code = "FIN",
                Name = "Finance",
                ParentUnitId = RootOrganizationId,
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            });

        db.Locations.Add(new Location
        {
            Id = BangkokLocationId,
            Code = "BKK-HQ",
            Name = "Bangkok Office",
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        });

        db.Positions.AddRange(
            new Position
            {
                Id = ProgrammerPositionId,
                Code = "PROGRAMMER",
                Name = "Programmer",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new Position
            {
                Id = HrOfficerPositionId,
                Code = "HR_OFFICER",
                Name = "HR Officer",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new Position
            {
                Id = SupportPositionId,
                Code = "IT_SUPPORT",
                Name = "IT Support",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            });

        db.UserProfiles.AddRange(
            User(
                UserId,
                KeycloakSubject,
                "EMP-00184",
                "Adisai Plomlee",
                DigitalTechnologyId,
                ProgrammerPositionId,
                "adisai@inno.local",
                "Floor 3",
                now),
            User(
                HrViewerUserId,
                HrViewerKeycloakSubject,
                "EMP-HR-002",
                "HR Scope Viewer",
                HumanResourcesId,
                HrOfficerPositionId,
                "hr.viewer@inno.local",
                "Floor 2",
                now),
            User(
                SupportAgentUserId,
                "33333333-3333-3333-3333-333333333333",
                "EMP-IT-007",
                "Narin Support",
                DigitalTechnologyId,
                SupportPositionId,
                "narin.support@inno.local",
                "Floor 3",
                now),
            User(
                SomchaiUserId,
                "44444444-4444-4444-4444-444444444444",
                "EMP-HR-014",
                "Somchai Prasert",
                HumanResourcesId,
                HrOfficerPositionId,
                "somchai@inno.local",
                "Floor 3",
                now));

        db.Roles.AddRange(
            Role(PlatformAdminRoleId, "platform_admin", "Platform Admin", now),
            Role(DeviceViewerRoleId, "device_viewer", "Device Viewer", now),
            Role(SupportAgentRoleId, "support_agent", "Support Agent", now),
            Role(EmployeeHelpdeskRoleId, "employee_helpdesk", "Employee", now));

        var basePermissions = new[]
        {
            new Permission { PermissionId = "platform.workspace.access", Module = "platform", Name = "Workspace access" },
            new Permission { PermissionId = "devices.view", Module = "devices", Name = "View devices" },
            new Permission { PermissionId = "devices.manage", Module = "devices", Name = "Manage devices" },
            new Permission { PermissionId = "devices.deploy", Module = "devices", Name = "Deploy device agents and software" },
            new Permission { PermissionId = "devices.remote", Module = "devices", Name = "Remote devices" }
        };
        db.Permissions.AddRange(basePermissions);
        db.Permissions.AddRange(Step17Permissions.Select(x => new Permission
        {
            PermissionId = x.Id,
            Module = x.Module,
            Name = x.Name
        }));
        db.Permissions.AddRange(Step18Permissions.Select(x => new Permission
        {
            PermissionId = x.Id,
            Module = x.Module,
            Name = x.Name
        }));
        db.Permissions.AddRange(Step19Permissions.Select(x => new Permission
        {
            PermissionId = x.Id,
            Module = x.Module,
            Name = x.Name
        }));
        db.Permissions.AddRange(Step21Permissions.Select(x => new Permission
        {
            PermissionId = x.Id,
            Module = x.Module,
            Name = x.Name
        }));
        db.Permissions.AddRange(Step22Permissions.Select(x => new Permission
        {
            PermissionId = x.Id,
            Module = x.Module,
            Name = x.Name
        }));
        db.Permissions.AddRange(Step23Permissions.Select(x => new Permission
        {
            PermissionId = x.Id,
            Module = x.Module,
            Name = x.Name
        }));

        db.Permissions.AddRange(Step26Permissions.Select(x => new Permission
        {
            PermissionId = x.Id,
            Module = x.Module,
            Name = x.Name
        }));
        db.Permissions.AddRange(Step30Permissions.Select(x => new Permission
        {
            PermissionId = x.Id,
            Module = x.Module,
            Name = x.Name
        }));
        db.Permissions.AddRange(Step31Permissions.Select(x => new Permission
        {
            PermissionId = x.Id,
            Module = x.Module,
            Name = x.Name
        }));
        db.Permissions.AddRange(Step32Permissions.Select(x => new Permission
        {
            PermissionId = x.Id,
            Module = x.Module,
            Name = x.Name
        }));

        db.RolePermissions.AddRange(basePermissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.PermissionId
        }));
        db.RolePermissions.AddRange(Step17Permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.Id
        }));
        db.RolePermissions.AddRange(Step18Permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.Id
        }));
        db.RolePermissions.AddRange(Step19Permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.Id
        }));
        db.RolePermissions.AddRange(Step21Permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.Id
        }));
        db.RolePermissions.AddRange(Step22Permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.Id
        }));
        db.RolePermissions.AddRange(Step23Permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.Id
        }));

        db.RolePermissions.AddRange(Step26Permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.Id
        }));
        db.RolePermissions.AddRange(Step30Permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.Id
        }));
        db.RolePermissions.AddRange(Step31Permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.Id
        }));
        db.RolePermissions.AddRange(Step32Permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.Id
        }));

        db.RolePermissions.AddRange(
            new RolePermission { RoleId = DeviceViewerRoleId, PermissionId = "platform.workspace.access" },
            new RolePermission { RoleId = DeviceViewerRoleId, PermissionId = "platform.apps.view" },
            new RolePermission { RoleId = DeviceViewerRoleId, PermissionId = "devices.view" },
            new RolePermission { RoleId = DeviceViewerRoleId, PermissionId = "helpdesk.ticket.view" },
            new RolePermission { RoleId = DeviceViewerRoleId, PermissionId = "helpdesk.ticket.create" },
            new RolePermission { RoleId = DeviceViewerRoleId, PermissionId = "assets.qr.scan" });

        foreach (var permissionId in new[]
        {
            "platform.workspace.access",
            "platform.apps.view",
            "devices.view",
            "assets.view",
            "assets.qr.scan",
            "helpdesk.ticket.view",
            "helpdesk.ticket.create",
            "helpdesk.ticket.reply",
            "helpdesk.ticket.assign",
            "helpdesk.ticket.resolve"
        })
        {
            db.RolePermissions.Add(new RolePermission
            {
                RoleId = SupportAgentRoleId,
                PermissionId = permissionId
            });
        }

        foreach (var permissionId in new[]
        {
            "platform.workspace.access",
            "platform.apps.view",
            "helpdesk.ticket.view",
            "helpdesk.ticket.create"
        })
        {
            db.RolePermissions.Add(new RolePermission
            {
                RoleId = EmployeeHelpdeskRoleId,
                PermissionId = permissionId
            });
        }

        AddAssignment(
            db,
            AssignmentId,
            UserId,
            PlatformAdminRoleId,
            RootOrganizationId,
            true,
            now);
        AddAssignment(
            db,
            HrAssignmentId,
            HrViewerUserId,
            DeviceViewerRoleId,
            HumanResourcesId,
            true,
            now);
        AddAssignment(
            db,
            SupportAssignmentId,
            SupportAgentUserId,
            SupportAgentRoleId,
            RootOrganizationId,
            true,
            now);
        AddAssignment(
            db,
            SomchaiAssignmentId,
            SomchaiUserId,
            EmployeeHelpdeskRoleId,
            HumanResourcesId,
            true,
            now);

        db.AppModules.AddRange(
            new AppModule
            {
                Id = Guid.Parse("70000000-0000-0000-0000-000000000001"),
                AppId = "devices",
                Installed = true,
                Enabled = true,
                UpdatedAt = now
            },
            new AppModule
            {
                Id = Guid.Parse("70000000-0000-0000-0000-000000000002"),
                AppId = "helpdesk",
                Installed = true,
                Enabled = true,
                UpdatedAt = now
            },
            new AppModule
            {
                Id = Guid.Parse("70000000-0000-0000-0000-000000000003"),
                AppId = "assets",
                Installed = true,
                Enabled = true,
                UpdatedAt = now
            });

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureStep16To23Async(
        PlatformDbContext db,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        if (!await db.Permissions.AnyAsync(
            x => x.PermissionId == "devices.deploy",
            cancellationToken))
        {
            db.Permissions.Add(new Permission
            {
                PermissionId = "devices.deploy",
                Module = "devices",
                Name = "Deploy device agents and software"
            });
        }

        foreach (var (permissionId, module, name) in Step17Permissions
            .Concat(Step18Permissions)
            .Concat(Step19Permissions)
            .Concat(Step21Permissions)
            .Concat(Step22Permissions)
            .Concat(Step23Permissions)
            .Concat(Step26Permissions)
            .Concat(Step30Permissions)
            .Concat(Step31Permissions)
            .Concat(Step32Permissions))
        {
            if (!await db.Permissions.AnyAsync(
                x => x.PermissionId == permissionId,
                cancellationToken))
            {
                db.Permissions.Add(new Permission
                {
                    PermissionId = permissionId,
                    Module = module,
                    Name = name
                });
            }
        }

        if (!await db.Roles.AnyAsync(x => x.Id == SupportAgentRoleId, cancellationToken))
        {
            db.Roles.Add(Role(
                SupportAgentRoleId,
                "support_agent",
                "Support Agent",
                now));
        }

        if (!await db.Roles.AnyAsync(x => x.Id == EmployeeHelpdeskRoleId, cancellationToken))
        {
            db.Roles.Add(Role(
                EmployeeHelpdeskRoleId,
                "employee_helpdesk",
                "Employee",
                now));
        }

        if (!await db.Positions.AnyAsync(x => x.Id == SupportPositionId, cancellationToken))
        {
            db.Positions.Add(new Position
            {
                Id = SupportPositionId,
                Code = "IT_SUPPORT",
                Name = "IT Support",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        if (!await db.UserProfiles.AnyAsync(x => x.Id == SupportAgentUserId, cancellationToken))
        {
            db.UserProfiles.Add(User(
                SupportAgentUserId,
                "33333333-3333-3333-3333-333333333333",
                "EMP-IT-007",
                "Narin Support",
                DigitalTechnologyId,
                SupportPositionId,
                "narin.support@inno.local",
                "Floor 3",
                now));
        }

        if (!await db.UserProfiles.AnyAsync(x => x.Id == SomchaiUserId, cancellationToken))
        {
            db.UserProfiles.Add(User(
                SomchaiUserId,
                "44444444-4444-4444-4444-444444444444",
                "EMP-HR-014",
                "Somchai Prasert",
                HumanResourcesId,
                HrOfficerPositionId,
                "somchai@inno.local",
                "Floor 3",
                now));
        }

        await db.SaveChangesAsync(cancellationToken);

        await EnsureRolePermissionAsync(
            db,
            PlatformAdminRoleId,
            "devices.deploy",
            cancellationToken);

        foreach (var (permissionId, _, _) in Step17Permissions
            .Concat(Step18Permissions)
            .Concat(Step19Permissions)
            .Concat(Step21Permissions)
            .Concat(Step22Permissions)
            .Concat(Step23Permissions)
            .Concat(Step26Permissions)
            .Concat(Step30Permissions)
            .Concat(Step31Permissions)
            .Concat(Step32Permissions))
        {
            await EnsureRolePermissionAsync(
                db,
                PlatformAdminRoleId,
                permissionId,
                cancellationToken);
        }

        foreach (var permissionId in new[]
        {
            "platform.apps.view",
            "helpdesk.ticket.view",
            "helpdesk.ticket.create",
            "assets.qr.scan"
        })
        {
            await EnsureRolePermissionAsync(
                db,
                DeviceViewerRoleId,
                permissionId,
                cancellationToken);
        }

        foreach (var permissionId in new[]
        {
            "platform.workspace.access",
            "platform.apps.view",
            "devices.view",
            "assets.view",
            "assets.qr.scan",
            "helpdesk.ticket.view",
            "helpdesk.ticket.create",
            "helpdesk.ticket.reply",
            "helpdesk.ticket.assign",
            "helpdesk.ticket.resolve"
        })
        {
            await EnsureRolePermissionAsync(
                db,
                SupportAgentRoleId,
                permissionId,
                cancellationToken);
        }

        foreach (var permissionId in new[]
        {
            "platform.workspace.access",
            "platform.apps.view",
            "helpdesk.ticket.view",
            "helpdesk.ticket.create"
        })
        {
            await EnsureRolePermissionAsync(
                db,
                EmployeeHelpdeskRoleId,
                permissionId,
                cancellationToken);
        }

        if (!await db.AccessAssignments.AnyAsync(
            x => x.Id == SupportAssignmentId,
            cancellationToken))
        {
            AddAssignment(
                db,
                SupportAssignmentId,
                SupportAgentUserId,
                SupportAgentRoleId,
                RootOrganizationId,
                true,
                now);
        }

        if (!await db.AccessAssignments.AnyAsync(
            x => x.Id == SomchaiAssignmentId,
            cancellationToken))
        {
            AddAssignment(
                db,
                SomchaiAssignmentId,
                SomchaiUserId,
                EmployeeHelpdeskRoleId,
                HumanResourcesId,
                true,
                now);
        }

        if (!await db.AppModules.AnyAsync(
            x => x.AppId == "helpdesk",
            cancellationToken))
        {
            db.AppModules.Add(new AppModule
            {
                Id = Guid.Parse("70000000-0000-0000-0000-000000000002"),
                AppId = "helpdesk",
                Installed = true,
                Enabled = true,
                UpdatedAt = now
            });
        }

        if (!await db.AppModules.AnyAsync(
            x => x.AppId == "assets",
            cancellationToken))
        {
            db.AppModules.Add(new AppModule
            {
                Id = Guid.Parse("70000000-0000-0000-0000-000000000003"),
                AppId = "assets",
                Installed = true,
                Enabled = true,
                UpdatedAt = now
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureRolePermissionAsync(
        PlatformDbContext db,
        Guid roleId,
        string permissionId,
        CancellationToken cancellationToken)
    {
        if (!await db.RolePermissions.AnyAsync(
            x => x.RoleId == roleId && x.PermissionId == permissionId,
            cancellationToken))
        {
            db.RolePermissions.Add(new RolePermission
            {
                RoleId = roleId,
                PermissionId = permissionId
            });
        }
    }

    private static UserProfile User(
        Guid id,
        string subject,
        string employeeId,
        string name,
        Guid organizationId,
        Guid positionId,
        string email,
        string office,
        DateTimeOffset now) =>
        new()
        {
            Id = id,
            KeycloakSubject = subject,
            EmployeeId = employeeId,
            FullName = name,
            OrganizationUnitId = organizationId,
            PositionId = positionId,
            LocationId = BangkokLocationId,
            Email = email,
            Office = office,
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        };

    private static Role Role(
        Guid id,
        string code,
        string name,
        DateTimeOffset now) =>
        new()
        {
            Id = id,
            Code = code,
            Name = name,
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        };

    private static void AddAssignment(
        PlatformDbContext db,
        Guid assignmentId,
        Guid userId,
        Guid roleId,
        Guid organizationId,
        bool includeChildren,
        DateTimeOffset now)
    {
        db.AccessAssignments.Add(new AccessAssignment
        {
            Id = assignmentId,
            SubjectType = "user",
            SubjectId = userId,
            RoleId = roleId,
            ScopeType = "organization",
            IncludeChildren = includeChildren,
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        });
        db.AccessAssignmentResources.Add(new AccessAssignmentResource
        {
            AssignmentId = assignmentId,
            ResourceType = "organization",
            ResourceId = organizationId
        });
    }
}
