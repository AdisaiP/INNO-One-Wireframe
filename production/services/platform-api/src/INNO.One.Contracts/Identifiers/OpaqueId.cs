namespace INNO.One.Contracts.Identifiers;

public static class OpaqueId
{
    public static string Format(string prefix, Guid value) => $"{prefix}_{value:N}";

    public static bool TryParse(string? value, string prefix, out Guid id)
    {
        id = Guid.Empty;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var expectedPrefix = prefix + "_";
        if (!value.StartsWith(expectedPrefix, StringComparison.Ordinal))
        {
            return false;
        }

        return Guid.TryParseExact(value[expectedPrefix.Length..], "N", out id);
    }
}
