using System.Security.Claims;
using INNO.One.Modules.Platform.Application;
using INNO.One.Modules.Platform.Domain;

namespace INNO.One.Platform.IntegrationTests;

[Collection(PlatformDatabaseCollection.CollectionName)]
public sealed class AccessEvaluatorIntegrationTests(PlatformDatabaseFixture database)
{
    private const string ViewPermission = "admin.users.view";

    [Fact]
    public async Task MissingSubject_IsDeniedAsUnauthenticated()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        var evaluator = new AccessEvaluator(db);

        var access = await evaluator.EvaluateAsync(new ClaimsPrincipal(new ClaimsIdentity("test")), ViewPermission);

        Assert.False(access.Allowed);
        Assert.Equal("UNAUTHENTICATED", access.Reason);
    }

    [Fact]
    public async Task UnknownSubject_IsDeniedAsProfileNotFound()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        var evaluator = new AccessEvaluator(db);

        var access = await evaluator.EvaluateAsync(Principal("missing-user"), ViewPermission);

        Assert.False(access.Allowed);
        Assert.Equal("PROFILE_NOT_FOUND", access.Reason);
    }

    [Theory]
    [InlineData("pending")]
    [InlineData("inactive")]
    [InlineData("disabled")]
    public async Task NonActiveProfile_IsDenied(string status)
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        db.UserProfiles.Add(User("subject-1", status));
        await db.SaveChangesAsync();

        var evaluator = new AccessEvaluator(db);
        var access = await evaluator.EvaluateAsync(Principal("subject-1"), ViewPermission);

        Assert.False(access.Allowed);
        Assert.Equal("PROFILE_NOT_ACTIVE", access.Reason);
    }

    [Fact]
    public async Task ActiveProfileWithoutPermission_IsDenied()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        db.UserProfiles.Add(User("subject-1", "active"));
        await db.SaveChangesAsync();

        var evaluator = new AccessEvaluator(db);
        var access = await evaluator.EvaluateAsync(Principal("subject-1"), ViewPermission);

        Assert.False(access.Allowed);
        Assert.Equal("PERMISSION_NOT_GRANTED", access.Reason);
    }

    [Fact]
    public async Task ActiveProfileWithGrantedAllScope_IsAllowed()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        var user = User("subject-1", "active");
        var role = Role("admin-reader");
        var assignment = Assignment(user.Id, role.Id, "all");

        db.AddRange(
            user,
            role,
            Permission(ViewPermission),
            new RolePermission { RoleId = role.Id, PermissionId = ViewPermission },
            assignment);
        await db.SaveChangesAsync();

        var evaluator = new AccessEvaluator(db);
        var access = await evaluator.EvaluateAsync(Principal(user.KeycloakSubject), ViewPermission);

        Assert.True(access.Allowed);
        Assert.True(access.AllResources);
        Assert.Equal("ROLE_AND_SCOPE_MATCH", access.Reason);
        Assert.Contains(assignment.Id, access.MatchedAssignmentIds);
    }

    [Fact]
    public async Task DisabledModule_DeniesModulePermissionBeforeRoleEvaluation()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        var user = User("subject-1", "active");
        db.AddRange(
            user,
            new AppModule
            {
                Id = Guid.NewGuid(),
                AppId = "devices",
                Installed = true,
                Enabled = false,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        await db.SaveChangesAsync();

        var evaluator = new AccessEvaluator(db);
        var access = await evaluator.EvaluateAsync(Principal(user.KeycloakSubject), "devices.view");

        Assert.False(access.Allowed);
        Assert.Equal("MODULE_DISABLED", access.Reason);
    }

    [Fact]
    public async Task ChangingAssignedRole_ChangesEffectivePermission()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        var user = User("subject-1", "active");
        var grantingRole = Role("granting-role");
        var emptyRole = Role("empty-role");
        var assignment = Assignment(user.Id, grantingRole.Id, "all");

        db.AddRange(
            user,
            grantingRole,
            emptyRole,
            Permission(ViewPermission),
            new RolePermission { RoleId = grantingRole.Id, PermissionId = ViewPermission },
            assignment);
        await db.SaveChangesAsync();

        var evaluator = new AccessEvaluator(db);
        var before = await evaluator.EvaluateAsync(Principal(user.KeycloakSubject), ViewPermission);
        Assert.True(before.Allowed);

        assignment.RoleId = emptyRole.Id;
        assignment.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        var after = await evaluator.EvaluateAsync(Principal(user.KeycloakSubject), ViewPermission);
        Assert.False(after.Allowed);
        Assert.Equal("PERMISSION_NOT_GRANTED", after.Reason);
    }

    [Fact]
    public async Task OrganizationScope_WithIncludeChildren_ExpandsDescendants()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        var root = Organization("ORG-ROOT");
        var child = Organization("ORG-CHILD", root.Id);
        var grandchild = Organization("ORG-GRANDCHILD", child.Id);
        var user = User("subject-1", "active");
        var role = Role("org-reader");
        var assignment = Assignment(user.Id, role.Id, "organization", includeChildren: true);

        db.AddRange(
            root,
            child,
            grandchild,
            user,
            role,
            Permission(ViewPermission),
            new RolePermission { RoleId = role.Id, PermissionId = ViewPermission },
            assignment,
            new AccessAssignmentResource
            {
                AssignmentId = assignment.Id,
                ResourceType = "organization",
                ResourceId = root.Id
            });
        await db.SaveChangesAsync();

        var access = await new AccessEvaluator(db)
            .EvaluateAsync(Principal(user.KeycloakSubject), ViewPermission);

        Assert.True(access.Allowed);
        Assert.False(access.AllResources);
        Assert.Contains(root.Id, access.OrganizationIds);
        Assert.Contains(child.Id, access.OrganizationIds);
        Assert.Contains(grandchild.Id, access.OrganizationIds);
    }

    [Fact]
    public async Task LocationScope_WithIncludeChildren_ExpandsDescendants()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        var root = Location("LOC-ROOT");
        var child = Location("LOC-CHILD", root.Id);
        var user = User("subject-1", "active");
        var role = Role("location-reader");
        var assignment = Assignment(user.Id, role.Id, "location", includeChildren: true);

        db.AddRange(
            root,
            child,
            user,
            role,
            Permission(ViewPermission),
            new RolePermission { RoleId = role.Id, PermissionId = ViewPermission },
            assignment,
            new AccessAssignmentResource
            {
                AssignmentId = assignment.Id,
                ResourceType = "location",
                ResourceId = root.Id
            });
        await db.SaveChangesAsync();

        var access = await new AccessEvaluator(db)
            .EvaluateAsync(Principal(user.KeycloakSubject), ViewPermission);

        Assert.True(access.Allowed);
        Assert.Contains(root.Id, access.LocationIds);
        Assert.Contains(child.Id, access.LocationIds);
    }

    [Fact]
    public async Task DeviceGroupScope_ReturnsOnlyAssignedGroups()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        var groupId = Guid.NewGuid();
        var user = User("subject-1", "active");
        var role = Role("group-reader");
        var assignment = Assignment(user.Id, role.Id, "device_group");

        db.AddRange(
            user,
            role,
            Permission(ViewPermission),
            new RolePermission { RoleId = role.Id, PermissionId = ViewPermission },
            assignment,
            new AccessAssignmentResource
            {
                AssignmentId = assignment.Id,
                ResourceType = "device_group",
                ResourceId = groupId
            });
        await db.SaveChangesAsync();

        var access = await new AccessEvaluator(db)
            .EvaluateAsync(Principal(user.KeycloakSubject), ViewPermission);

        Assert.True(access.Allowed);
        Assert.False(access.AllResources);
        Assert.Equal([groupId], access.DeviceGroupIds);
    }

    [Fact]
    public async Task ActionOverride_RestrictsAssignmentToExplicitPermissions()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        const string managePermission = "admin.users.manage";
        var user = User("subject-1", "active");
        var role = Role("admin-user-manager");
        var assignment = Assignment(user.Id, role.Id, "all");

        db.AddRange(
            user,
            role,
            Permission(ViewPermission),
            Permission(managePermission),
            new RolePermission { RoleId = role.Id, PermissionId = ViewPermission },
            new RolePermission { RoleId = role.Id, PermissionId = managePermission },
            assignment,
            new AccessAssignmentAction
            {
                AssignmentId = assignment.Id,
                PermissionId = managePermission
            });
        await db.SaveChangesAsync();

        var evaluator = new AccessEvaluator(db);
        var viewAccess = await evaluator.EvaluateAsync(Principal(user.KeycloakSubject), ViewPermission);
        var manageAccess = await evaluator.EvaluateAsync(Principal(user.KeycloakSubject), managePermission);

        Assert.False(viewAccess.Allowed);
        Assert.Equal("ACTION_OVERRIDE_DENIED", viewAccess.Reason);
        Assert.True(manageAccess.Allowed);
    }


    [Fact]
    public async Task EnabledModuleWithEntryPermission_IsAllowed()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        const string permission = "devices.view";
        var user = User("subject-1", "active");
        var role = Role("devices-reader");
        var assignment = Assignment(user.Id, role.Id, "all");

        db.AddRange(
            user,
            role,
            Permission(permission),
            new RolePermission { RoleId = role.Id, PermissionId = permission },
            assignment,
            new AppModule
            {
                Id = Guid.NewGuid(),
                AppId = "devices",
                Installed = true,
                Enabled = true,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        await db.SaveChangesAsync();

        var access = await new AccessEvaluator(db)
            .EvaluateAsync(Principal(user.KeycloakSubject), permission);

        Assert.True(access.Allowed);
        Assert.True(access.AllResources);
        Assert.Equal("ROLE_AND_SCOPE_MATCH", access.Reason);
    }

    [Fact]
    public async Task EnabledModuleWithoutEntryPermission_IsDenied()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        var user = User("subject-1", "active");

        db.AddRange(
            user,
            new AppModule
            {
                Id = Guid.NewGuid(),
                AppId = "devices",
                Installed = true,
                Enabled = true,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        await db.SaveChangesAsync();

        var access = await new AccessEvaluator(db)
            .EvaluateAsync(Principal(user.KeycloakSubject), "devices.view");

        Assert.False(access.Allowed);
        Assert.Equal("PERMISSION_NOT_GRANTED", access.Reason);
    }

    private static ClaimsPrincipal Principal(string subject) =>
        new(new ClaimsIdentity([new Claim("sub", subject)], "test"));

    private static UserProfile User(string subject, string status) =>
        new()
        {
            Id = Guid.NewGuid(),
            KeycloakSubject = subject,
            EmployeeId = $"EMP-{Guid.NewGuid():N}",
            FullName = "Integration Test User",
            Email = $"{Guid.NewGuid():N}@example.test",
            Status = status,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

    private static Role Role(string code) =>
        new()
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = code,
            Status = "active",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

    private static Permission Permission(string permissionId) =>
        new()
        {
            PermissionId = permissionId,
            Module = permissionId.Split('.', 2)[0],
            Name = permissionId
        };

    private static AccessAssignment Assignment(
        Guid userId,
        Guid roleId,
        string scopeType,
        bool includeChildren = false) =>
        new()
        {
            Id = Guid.NewGuid(),
            SubjectType = "user",
            SubjectId = userId,
            RoleId = roleId,
            ScopeType = scopeType,
            IncludeChildren = includeChildren,
            Status = "active",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

    private static OrganizationUnit Organization(string code, Guid? parentId = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = code,
            ParentUnitId = parentId,
            Status = "active",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

    private static Location Location(string code, Guid? parentId = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = code,
            ParentLocationId = parentId,
            Status = "active",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
}
