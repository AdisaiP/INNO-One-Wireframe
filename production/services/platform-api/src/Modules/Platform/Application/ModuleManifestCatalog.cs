using System.Reflection;
using System.Text.Json;

namespace INNO.One.Modules.Platform.Application;

public sealed record ModuleNavigationManifest(
    string Id,
    string Label,
    string Route,
    string Permission);

public sealed record ModuleManifest(
    string Id,
    string Name,
    string Icon,
    string Route,
    string Surface,
    bool Launcher,
    string EntryPermission,
    IReadOnlyList<string> Dependencies,
    IReadOnlyList<string> Permissions,
    IReadOnlyList<ModuleNavigationManifest> Navigation,
    IReadOnlyList<string> Events,
    IReadOnlyList<string> Capabilities);

public sealed record ModuleManifestDocument(
    int SchemaVersion,
    IReadOnlyList<ModuleManifest> Modules);
public sealed class ModuleManifestCatalog
{
    public const int SupportedSchemaVersion = 1;
    private const string ResourceName = "INNO.One.ModuleManifests.json";

    private readonly IReadOnlyDictionary<string, ModuleManifest> _byId;

    public ModuleManifestCatalog()
    {
        var assembly = typeof(ModuleManifestCatalog).Assembly;
        using var stream = assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException(
                $"Embedded module manifest resource '{ResourceName}' was not found.");

        var document = JsonSerializer.Deserialize<ModuleManifestDocument>(
            stream,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            })
            ?? throw new InvalidOperationException("Module manifest document is empty.");

        Validate(document);
        SchemaVersion = document.SchemaVersion;
        Modules = document.Modules
            .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();
        _byId = Modules.ToDictionary(x => x.Id, StringComparer.Ordinal);
    }

    public int SchemaVersion { get; }
    public IReadOnlyList<ModuleManifest> Modules { get; }

    public bool TryGet(string moduleId, out ModuleManifest manifest) =>
        _byId.TryGetValue(moduleId, out manifest!);
    private static void Validate(ModuleManifestDocument document)
    {
        if (document.SchemaVersion != SupportedSchemaVersion)
        {
            throw new InvalidOperationException(
                $"Unsupported module manifest schema {document.SchemaVersion}. "
                + $"Expected {SupportedSchemaVersion}.");
        }

        if (document.Modules.Count == 0)
        {
            throw new InvalidOperationException("At least one module manifest is required.");
        }

        var duplicateId = document.Modules
            .GroupBy(x => x.Id, StringComparer.Ordinal)
            .FirstOrDefault(x => x.Count() > 1);
        if (duplicateId is not null)
        {
            throw new InvalidOperationException(
                $"Duplicate module id '{duplicateId.Key}'.");
        }

        var duplicateRoute = document.Modules
            .GroupBy(x => x.Route, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(x => x.Count() > 1);
        if (duplicateRoute is not null)
        {
            throw new InvalidOperationException(
                $"Duplicate module route '{duplicateRoute.Key}'.");
        }

        var moduleIds = document.Modules
            .Select(x => x.Id)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var module in document.Modules)
        {
            if (string.IsNullOrWhiteSpace(module.Id)
                || string.IsNullOrWhiteSpace(module.Name)
                || string.IsNullOrWhiteSpace(module.Route)
                || string.IsNullOrWhiteSpace(module.EntryPermission))
            {
                throw new InvalidOperationException(
                    "Module id, name, route and entryPermission are required.");
            }

            if (!module.Route.StartsWith('/'))
            {
                throw new InvalidOperationException(
                    $"Module '{module.Id}' route must be absolute.");
            }

            if (!module.EntryPermission.StartsWith(
                    module.Id + ".",
                    StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    $"Module '{module.Id}' entryPermission must belong to the module namespace.");
            }

            if (!module.Permissions.Contains(
                    module.EntryPermission,
                    StringComparer.Ordinal))
            {
                throw new InvalidOperationException(
                    $"Module '{module.Id}' must declare its entryPermission.");
            }

            foreach (var dependency in module.Dependencies)
            {
                if (string.Equals(dependency, module.Id, StringComparison.Ordinal)
                    || (!string.Equals(dependency, "platform", StringComparison.Ordinal)
                        && !moduleIds.Contains(dependency)))
                {
                    throw new InvalidOperationException(
                        $"Module '{module.Id}' has invalid dependency '{dependency}'.");
                }
            }

            foreach (var navigation in module.Navigation)
            {
                if (!navigation.Route.StartsWith(
                        module.Route,
                        StringComparison.OrdinalIgnoreCase)
                    || !module.Permissions.Contains(
                        navigation.Permission,
                        StringComparer.Ordinal))
                {
                    throw new InvalidOperationException(
                        $"Module '{module.Id}' has invalid navigation '{navigation.Id}'.");
                }
            }

            var duplicateNavigationRoute = module.Navigation
                .GroupBy(x => x.Route, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault(x => x.Count() > 1);
            if (duplicateNavigationRoute is not null)
            {
                throw new InvalidOperationException(
                    $"Module '{module.Id}' has duplicate navigation route "
                    + $"'{duplicateNavigationRoute.Key}'.");
            }
        }
    }
}
