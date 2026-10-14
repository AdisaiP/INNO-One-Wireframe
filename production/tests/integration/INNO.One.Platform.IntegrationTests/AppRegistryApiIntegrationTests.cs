using System.Net;
using System.Text.Json;
using INNO.One.Modules.Platform.Domain;

namespace INNO.One.Platform.IntegrationTests;

[Collection(PlatformDatabaseCollection.CollectionName)]
public sealed class AppRegistryApiIntegrationTests(PlatformDatabaseFixture database)
{
    [Fact]
    public async Task EnabledModuleWithEntryPermission_IsVisibleInLauncher()
    {
        await database.ResetAsync();
        var setup = await SeedAccessAsync(
            permissions: ["platform.apps.view", "devices.view"],
            modules:
            [
                Module("devices", enabled: true)
            ]);

        using var factory = new PlatformApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Subject", setup.Subject);

        var response = await client.GetAsync("/api/v1/platform/apps");
        var ids = await ReadLauncherIdsAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("devices", ids);
    }

    [Fact]
    public async Task EnabledModuleWithoutEntryPermission_IsHiddenFromLauncher()
    {
        await database.ResetAsync();
        var setup = await SeedAccessAsync(
            permissions: ["platform.apps.view"],
            modules:
            [
                Module("devices", enabled: true)
            ]);

        using var factory = new PlatformApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Subject", setup.Subject);

        var response = await client.GetAsync("/api/v1/platform/apps");
        var ids = await ReadLauncherIdsAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("devices", ids);
    }

    [Fact]
    public async Task EnabledModuleWithDisabledDependency_IsHiddenFromLauncher()
    {
        await database.ResetAsync();
        var setup = await SeedAccessAsync(
            permissions: ["platform.apps.view", "assets.view", "devices.view"],
            modules:
            [
                Module("devices", enabled: false),
                Module("assets", enabled: true)
            ]);

        using var factory = new PlatformApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Subject", setup.Subject);

        var response = await client.GetAsync("/api/v1/platform/apps");
        var ids = await ReadLauncherIdsAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("assets", ids);
        Assert.DoesNotContain("devices", ids);
    }

    private async Task<(string Subject, Guid UserId)> SeedAccessAsync(
        IReadOnlyCollection<string> permissions,
        IReadOnlyCollection<AppModule> modules)
    {
        const string subject = "app-registry-user";
        var user = User(subject);
        var role = Role("launcher-role");
        var assignment = new AccessAssignment
        {
            Id = Guid.NewGuid(),
            SubjectType = "user",
            SubjectId = user.Id,
            RoleId = role.Id,
            ScopeType = "all",
            IncludeChildren = false,
            Status = "active",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await using var db = database.CreatePlatformDbContext();
        db.AddRange(user, role, assignment);
        db.AppModules.AddRange(modules);

        foreach (var permissionId in permissions)
        {
            db.Permissions.Add(new Permission
            {
                PermissionId = permissionId,
                Module = permissionId.Split('.', 2)[0],
                Name = permissionId
            });
            db.RolePermissions.Add(new RolePermission
            {
                RoleId = role.Id,
                PermissionId = permissionId
            });
        }

        await db.SaveChangesAsync();
        return (subject, user.Id);
    }

    private static async Task<IReadOnlySet<string>> ReadLauncherIdsAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            return new HashSet<string>(StringComparer.Ordinal);
        }

        using var document = JsonDocument.Parse(json);
        return document.RootElement
            .GetProperty("items")
            .EnumerateArray()
            .Select(item => item.GetProperty("id").GetString())
            .Where(id => id is not null)
            .Select(id => id!)
            .ToHashSet(StringComparer.Ordinal);
    }

    private static UserProfile User(string subject) =>
        new()
        {
            Id = Guid.NewGuid(),
            KeycloakSubject = subject,
            EmployeeId = $"EMP-{Guid.NewGuid():N}",
            FullName = "App Registry Test User",
            Email = $"{Guid.NewGuid():N}@example.test",
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

    private static AppModule Module(string appId, bool enabled) =>
        new()
        {
            Id = Guid.NewGuid(),
            AppId = appId,
            Installed = true,
            Enabled = enabled,
            UpdatedAt = DateTimeOffset.UtcNow
        };
}
