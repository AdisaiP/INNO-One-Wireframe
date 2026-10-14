using INNO.One.Modules.Platform.Application;

namespace INNO.One.Platform.IntegrationTests;

public sealed class ModuleManifestCatalogTests
{
    [Fact]
    public void EmbeddedManifest_IsValidAndUsesExpectedDependencyGraph()
    {
        var catalog = new ModuleManifestCatalog();

        Assert.Equal(ModuleManifestCatalog.SupportedSchemaVersion, catalog.SchemaVersion);

        var byId = catalog.Modules.ToDictionary(x => x.Id, StringComparer.Ordinal);
        Assert.Equal(["platform"], byId["devices"].Dependencies);
        Assert.Equal(["platform", "devices"], byId["assets"].Dependencies);
        Assert.Equal(["platform", "devices", "assets"], byId["helpdesk"].Dependencies);
        Assert.Equal(["platform"], byId["meeting"].Dependencies);
        Assert.Equal(["platform", "devices", "assets", "helpdesk"], byId["reports"].Dependencies);
    }

    [Fact]
    public void EveryLauncherEntryPermission_IsDeclaredByItsModule()
    {
        var catalog = new ModuleManifestCatalog();

        foreach (var module in catalog.Modules.Where(x => x.Launcher))
        {
            Assert.StartsWith(module.Id + ".", module.EntryPermission, StringComparison.Ordinal);
            Assert.Contains(module.EntryPermission, module.Permissions);
        }
    }
}
