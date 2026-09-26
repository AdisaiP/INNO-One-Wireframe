using INNO.One.Modules.Platform.Domain;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Infrastructure;

public static class PlatformDevelopmentSeed
{
    public static readonly Guid UserId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    public static readonly Guid HrViewerUserId = Guid.Parse("10000000-0000-0000-0000-000000000002");
    public static readonly Guid RootOrganizationId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    public static readonly Guid DigitalTechnologyId = Guid.Parse("20000000-0000-0000-0000-000000000002");
    public static readonly Guid HumanResourcesId = Guid.Parse("20000000-0000-0000-0000-000000000003");
    public static readonly Guid FinanceId = Guid.Parse("20000000-0000-0000-0000-000000000004");
    public static readonly Guid BangkokLocationId = Guid.Parse("30000000-0000-0000-0000-000000000001");
    public static readonly Guid ProgrammerPositionId = Guid.Parse("40000000-0000-0000-0000-000000000001");
    public static readonly Guid HrOfficerPositionId = Guid.Parse("40000000-0000-0000-0000-000000000002");
    public static readonly Guid PlatformAdminRoleId = Guid.Parse("50000000-0000-0000-0000-000000000001");
    public static readonly Guid DeviceViewerRoleId = Guid.Parse("50000000-0000-0000-0000-000000000002");
    public static readonly Guid AssignmentId = Guid.Parse("60000000-0000-0000-0000-000000000001");
    public static readonly Guid HrAssignmentId = Guid.Parse("60000000-0000-0000-0000-000000000002");

    public const string KeycloakSubject = "11111111-1111-1111-1111-111111111111";
    public const string HrViewerKeycloakSubject = "22222222-2222-2222-2222-222222222222";

    public static async Task SeedAsync(PlatformDbContext db, CancellationToken cancellationToken = default)
    {
        if (await db.UserProfiles.AnyAsync(cancellationToken))
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;

        db.OrganizationUnits.AddRange(
            new OrganizationUnit
            {
                Id = RootOrganizationId, Code = "ISS", Name = "Innovations Solutions and Service",
                Status = "active", CreatedAt = now, UpdatedAt = now
            },
            new OrganizationUnit
            {
                Id = DigitalTechnologyId, Code = "DTD", Name = "Digital Technology",
                ParentUnitId = RootOrganizationId, Status = "active", CreatedAt = now, UpdatedAt = now
            },
            new OrganizationUnit
            {
                Id = HumanResourcesId, Code = "HR", Name = "Human Resources",
                ParentUnitId = RootOrganizationId, Status = "active", CreatedAt = now, UpdatedAt = now
            },
            new OrganizationUnit
            {
                Id = FinanceId, Code = "FIN", Name = "Finance",
                ParentUnitId = RootOrganizationId, Status = "active", CreatedAt = now, UpdatedAt = now
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
            });

        db.UserProfiles.AddRange(
            new UserProfile
            {
                Id = UserId,
                KeycloakSubject = KeycloakSubject,
                EmployeeId = "EMP-00184",
                FullName = "Adisai Plomlee",
                OrganizationUnitId = DigitalTechnologyId,
                PositionId = ProgrammerPositionId,
                LocationId = BangkokLocationId,
                Email = "adisai@inno.local",
                Phone = "02-577-9999 ext. 184",
                Office = "Floor 3",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new UserProfile
            {
                Id = HrViewerUserId,
                KeycloakSubject = HrViewerKeycloakSubject,
                EmployeeId = "EMP-HR-002",
                FullName = "HR Scope Viewer",
                OrganizationUnitId = HumanResourcesId,
                PositionId = HrOfficerPositionId,
                LocationId = BangkokLocationId,
                Email = "hr.viewer@inno.local",
                Office = "Floor 2",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            });

        db.Roles.AddRange(
            new Role
            {
                Id = PlatformAdminRoleId,
                Code = "platform_admin",
                Name = "Platform Admin",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            },
            new Role
            {
                Id = DeviceViewerRoleId,
                Code = "device_viewer",
                Name = "Device Viewer",
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            });

        var permissions = new[]
        {
            new Permission { PermissionId = "platform.workspace.access", Module = "platform", Name = "Workspace access" },
            new Permission { PermissionId = "devices.view", Module = "devices", Name = "View devices" },
            new Permission { PermissionId = "devices.manage", Module = "devices", Name = "Manage devices" },
            new Permission { PermissionId = "devices.remote", Module = "devices", Name = "Remote devices" }
        };
        db.Permissions.AddRange(permissions);
        db.RolePermissions.AddRange(permissions.Select(x => new RolePermission
        {
            RoleId = PlatformAdminRoleId,
            PermissionId = x.PermissionId
        }));
        db.RolePermissions.AddRange(
            new RolePermission { RoleId = DeviceViewerRoleId, PermissionId = "platform.workspace.access" },
            new RolePermission { RoleId = DeviceViewerRoleId, PermissionId = "devices.view" });

        db.AccessAssignments.Add(new AccessAssignment
        {
            Id = AssignmentId,
            SubjectType = "user",
            SubjectId = UserId,
            RoleId = PlatformAdminRoleId,
            ScopeType = "organization",
            IncludeChildren = true,
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        });
        db.AccessAssignmentResources.Add(new AccessAssignmentResource
        {
            AssignmentId = AssignmentId,
            ResourceType = "organization",
            ResourceId = RootOrganizationId
        });

        db.AccessAssignments.Add(new AccessAssignment
        {
            Id = HrAssignmentId,
            SubjectType = "user",
            SubjectId = HrViewerUserId,
            RoleId = DeviceViewerRoleId,
            ScopeType = "organization",
            IncludeChildren = true,
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        });
        db.AccessAssignmentResources.Add(new AccessAssignmentResource
        {
            AssignmentId = HrAssignmentId,
            ResourceType = "organization",
            ResourceId = HumanResourcesId
        });

        db.AppModules.Add(new AppModule
        {
            Id = Guid.Parse("70000000-0000-0000-0000-000000000001"),
            AppId = "devices",
            Installed = true,
            Enabled = true,
            UpdatedAt = now
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}
