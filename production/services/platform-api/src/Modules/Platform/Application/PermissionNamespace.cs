namespace INNO.One.Modules.Platform.Application;

public static class PermissionNamespace
{
    private static readonly HashSet<string> PlatformOwned =
        new(StringComparer.Ordinal)
        {
            "platform",
            "admin"
        };

    public static string Get(string permission)
    {
        if (string.IsNullOrWhiteSpace(permission))
        {
            return string.Empty;
        }

        return permission.Split('.', 2)[0];
    }

    public static bool RequiresModuleAvailability(string permission) =>
        !PlatformOwned.Contains(Get(permission));
}
