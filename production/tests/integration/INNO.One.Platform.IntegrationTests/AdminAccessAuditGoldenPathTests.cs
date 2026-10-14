using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Platform.Domain;

namespace INNO.One.Platform.IntegrationTests;

[Collection(PlatformDatabaseCollection.CollectionName)]
public sealed class AdminAccessAuditGoldenPathTests(PlatformDatabaseFixture database)
{
    [Fact]
    public async Task AdminUpdatesAssignment_EffectiveAccessChanges_AndAuditIsQueryable()
    {
        await database.ResetAsync();

        const string adminSubject = "admin-golden-path";
        const string targetSubject = "target-golden-path";
        const string correlationId = "core-golden-path-001";

        var admin = User(adminSubject, "Golden Path Admin");
        var target = User(targetSubject, "Golden Path Target");
        var adminRole = Role("golden-admin");
        var emptyRole = Role("golden-empty");
        var devicesRole = Role("golden-devices");
        var targetAssignment = Assignment(target.Id, emptyRole.Id);

        var adminPermissions = new[]
        {
            "admin.access_scopes.view",
            "admin.access_scopes.manage",
            "admin.access_scopes.evaluate",
            "admin.audit.view"
        };

        await using (var db = database.CreatePlatformDbContext())
        {
            db.AddRange(
                admin,
                target,
                adminRole,
                emptyRole,
                devicesRole,
                targetAssignment,
                new AppModule
                {
                    Id = Guid.NewGuid(),
                    AppId = "devices",
                    Installed = true,
                    Enabled = true,
                    UpdatedAt = DateTimeOffset.UtcNow
                });

            foreach (var permissionId in adminPermissions.Append("devices.view"))
            {
                db.Permissions.Add(Permission(permissionId));
            }

            foreach (var permissionId in adminPermissions)
            {
                db.RolePermissions.Add(new RolePermission
                {
                    RoleId = adminRole.Id,
                    PermissionId = permissionId
                });
            }

            db.RolePermissions.Add(new RolePermission
            {
                RoleId = devicesRole.Id,
                PermissionId = "devices.view"
            });
            db.AccessAssignments.Add(Assignment(admin.Id, adminRole.Id));

            await db.SaveChangesAsync();
        }

        using var factory = new PlatformApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Subject", adminSubject);
        client.DefaultRequestHeaders.Add("X-Correlation-Id", correlationId);

        var assignmentId = OpaqueId.Format("asg", targetAssignment.Id);
        var getResponse = await client.GetAsync($"/api/v1/admin/access-assignments/{assignmentId}");

        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var etag = Assert.Single(getResponse.Headers.ETag is null
            ? Array.Empty<string>()
            : new[] { getResponse.Headers.ETag.ToString() });

        using var updateRequest = new HttpRequestMessage(
            HttpMethod.Put,
            $"/api/v1/admin/access-assignments/{assignmentId}");
        updateRequest.Headers.TryAddWithoutValidation("If-Match", etag);
        updateRequest.Content = JsonContent.Create(new
        {
            roleId = OpaqueId.Format("role", devicesRole.Id),
            scopeType = "all",
            resourceIds = Array.Empty<string>(),
            includeChildren = false,
            actionOverrides = Array.Empty<string>(),
            status = "active"
        });

        var updateResponse = await client.SendAsync(updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var evaluationResponse = await client.PostAsJsonAsync(
            "/api/v1/admin/access-scopes/evaluate",
            new
            {
                userId = OpaqueId.Format("user", target.Id),
                permission = "devices.view"
            });

        Assert.Equal(HttpStatusCode.OK, evaluationResponse.StatusCode);
        using (var evaluationJson = JsonDocument.Parse(
                   await evaluationResponse.Content.ReadAsStringAsync()))
        {
            var data = evaluationJson.RootElement.GetProperty("data");
            Assert.True(data.GetProperty("allowed").GetBoolean());
            Assert.True(data.GetProperty("allResources").GetBoolean());
            Assert.Equal(
                "ROLE_AND_SCOPE_MATCH",
                data.GetProperty("reason").GetString());
        }

        var auditResponse = await client.GetAsync(
            "/api/v1/admin/audit?search=platform.access_assignment.updated&page=1&pageSize=20");

        Assert.Equal(HttpStatusCode.OK, auditResponse.StatusCode);
        using var auditJson = JsonDocument.Parse(
            await auditResponse.Content.ReadAsStringAsync());
        var items = auditJson.RootElement.GetProperty("items").EnumerateArray().ToArray();
        var audit = Assert.Single(items, item =>
            item.GetProperty("action").GetString() == "platform.access_assignment.updated"
            && item.GetProperty("correlationId").GetString() == correlationId);

        Assert.Equal("platform", audit.GetProperty("module").GetString());
        Assert.Equal("access_assignment", audit.GetProperty("targetType").GetString());
        Assert.Equal(assignmentId, audit.GetProperty("targetId").GetString());

        var traceId = audit.GetProperty("traceId").GetString();
        Assert.NotNull(traceId);
        Assert.Equal(32, traceId!.Length);
        Assert.All(traceId, character => Assert.True(char.IsAsciiHexDigit(character)));
    }

    private static UserProfile User(string subject, string name) =>
        new()
        {
            Id = Guid.NewGuid(),
            KeycloakSubject = subject,
            EmployeeId = $"EMP-{Guid.NewGuid():N}",
            FullName = name,
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
            Version = 1,
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

    private static AccessAssignment Assignment(Guid userId, Guid roleId) =>
        new()
        {
            Id = Guid.NewGuid(),
            SubjectType = "user",
            SubjectId = userId,
            RoleId = roleId,
            ScopeType = "all",
            IncludeChildren = false,
            Status = "active",
            Version = 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
}
