using System.Net;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Platform.Domain;

namespace INNO.One.Platform.IntegrationTests;

[Collection(PlatformDatabaseCollection.CollectionName)]
public sealed class DeviceScopeApiIntegrationTests(PlatformDatabaseFixture database)
{
    [Fact]
    public async Task DeviceDetail_OutsideAssignedOrganizationScope_ReturnsForbidden()
    {
        await database.ResetAsync();

        var allowedOrganization = Organization("ORG-ALLOWED");
        var deniedOrganization = Organization("ORG-DENIED");
        var user = User("scope-user");
        var role = Role("devices-reader");
        var assignment = Assignment(user.Id, role.Id, allowedOrganization.Id);

        await using (var platform = database.CreatePlatformDbContext())
        {
            platform.AddRange(
                allowedOrganization,
                deniedOrganization,
                user,
                role,
                Permission("devices.view"),
                new RolePermission { RoleId = role.Id, PermissionId = "devices.view" },
                assignment,
                new AccessAssignmentResource
                {
                    AssignmentId = assignment.Id,
                    ResourceType = "organization",
                    ResourceId = allowedOrganization.Id
                },
                new AppModule
                {
                    Id = Guid.NewGuid(),
                    AppId = "devices",
                    Installed = true,
                    Enabled = true,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            await platform.SaveChangesAsync();
        }

        var deniedDevice = Device("outside-scope", deniedOrganization.Id);
        await using (var devices = database.CreateDevicesDbContext())
        {
            devices.Devices.Add(deniedDevice);
            await devices.SaveChangesAsync();
        }

        using var factory = new PlatformApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Subject", user.KeycloakSubject);

        var response = await client.GetAsync(
            $"/api/v1/devices/{OpaqueId.Format("dev", deniedDevice.Id)}");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Contains("OUTSIDE_ASSIGNED_SCOPE", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task DeviceDetail_InsideAssignedOrganizationScope_ReturnsOk()
    {
        await database.ResetAsync();

        var allowedOrganization = Organization("ORG-ALLOWED");
        var user = User("scope-user");
        var role = Role("devices-reader");
        var assignment = Assignment(user.Id, role.Id, allowedOrganization.Id);

        await using (var platform = database.CreatePlatformDbContext())
        {
            platform.AddRange(
                allowedOrganization,
                user,
                role,
                Permission("devices.view"),
                new RolePermission { RoleId = role.Id, PermissionId = "devices.view" },
                assignment,
                new AccessAssignmentResource
                {
                    AssignmentId = assignment.Id,
                    ResourceType = "organization",
                    ResourceId = allowedOrganization.Id
                },
                new AppModule
                {
                    Id = Guid.NewGuid(),
                    AppId = "devices",
                    Installed = true,
                    Enabled = true,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            await platform.SaveChangesAsync();
        }

        var allowedDevice = Device("inside-scope", allowedOrganization.Id);
        await using (var devices = database.CreateDevicesDbContext())
        {
            devices.Devices.Add(allowedDevice);
            await devices.SaveChangesAsync();
        }

        using var factory = new PlatformApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Subject", user.KeycloakSubject);

        var response = await client.GetAsync(
            $"/api/v1/devices/{OpaqueId.Format("dev", allowedDevice.Id)}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static UserProfile User(string subject) =>
        new()
        {
            Id = Guid.NewGuid(),
            KeycloakSubject = subject,
            EmployeeId = $"EMP-{Guid.NewGuid():N}",
            FullName = "Scope Test User",
            Email = $"{Guid.NewGuid():N}@example.test",
            Status = "active",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

    private static OrganizationUnit Organization(string code) =>
        new()
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = code,
            Status = "active",
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
            Module = "devices",
            Name = permissionId
        };

    private static AccessAssignment Assignment(Guid userId, Guid roleId, Guid organizationId) =>
        new()
        {
            Id = Guid.NewGuid(),
            SubjectType = "user",
            SubjectId = userId,
            RoleId = roleId,
            ScopeType = "organization",
            IncludeChildren = false,
            Status = "active",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

    private static Device Device(string hostname, Guid organizationId) =>
        new()
        {
            Id = Guid.NewGuid(),
            Hostname = hostname,
            DeviceType = "workstation",
            ConnectivityState = "online",
            OrganizationUnitId = organizationId,
            LastSeenAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
}
