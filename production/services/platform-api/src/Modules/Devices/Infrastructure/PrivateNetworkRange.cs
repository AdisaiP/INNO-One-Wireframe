using System.Net;
using System.Net.Sockets;

namespace INNO.One.Modules.Devices.Infrastructure;

public static class PrivateNetworkRange
{
    public const int MaximumAddressesPerScan = 512;

    public static bool TryExpand(
        IReadOnlyCollection<string> ranges,
        out IReadOnlyList<IPAddress> addresses,
        out string? error)
    {
        var result = new List<IPAddress>();
        error = null;

        if (ranges.Count == 0)
        {
            addresses = result;
            error = "At least one private IPv4 CIDR range is required.";
            return false;
        }

        foreach (var range in ranges)
        {
            var parts = range.Trim().Split('/', StringSplitOptions.TrimEntries);
            if (parts.Length != 2
                || !IPAddress.TryParse(parts[0], out var address)
                || address.AddressFamily != AddressFamily.InterNetwork
                || !int.TryParse(parts[1], out var prefix)
                || prefix is < 8 or > 32)
            {
                addresses = Array.Empty<IPAddress>();
                error = $"Invalid IPv4 CIDR range: {range}";
                return false;
            }

            if (!IsPrivateOrLoopback(address))
            {
                addresses = Array.Empty<IPAddress>();
                error = $"Discovery is limited to private or loopback IPv4 ranges: {range}";
                return false;
            }

            var count = 1L << (32 - prefix);
            if (count > MaximumAddressesPerScan
                || result.Count + count > MaximumAddressesPerScan)
            {
                addresses = Array.Empty<IPAddress>();
                error = $"A discovery scan may contain at most {MaximumAddressesPerScan} addresses.";
                return false;
            }

            var raw = address.GetAddressBytes();
            var value = ((uint)raw[0] << 24)
                | ((uint)raw[1] << 16)
                | ((uint)raw[2] << 8)
                | raw[3];
            var mask = prefix == 0 ? 0U : uint.MaxValue << (32 - prefix);
            var network = value & mask;

            for (var i = 0U; i < count; i++)
            {
                var current = network + i;
                result.Add(new IPAddress(new byte[]
                {
                    (byte)(current >> 24),
                    (byte)(current >> 16),
                    (byte)(current >> 8),
                    (byte)current
                }));
            }
        }

        addresses = result
            .DistinctBy(x => x.ToString(), StringComparer.Ordinal)
            .ToArray();
        return true;
    }

    private static bool IsPrivateOrLoopback(IPAddress address)
    {
        var b = address.GetAddressBytes();
        return b[0] == 10
            || (b[0] == 172 && b[1] is >= 16 and <= 31)
            || (b[0] == 192 && b[1] == 168)
            || b[0] == 127
            || (b[0] == 169 && b[1] == 254);
    }
}
