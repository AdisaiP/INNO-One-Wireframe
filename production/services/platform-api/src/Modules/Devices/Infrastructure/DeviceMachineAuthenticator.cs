using System.Security.Cryptography;
using System.Text;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Infrastructure;

public sealed class DeviceMachineAuthenticator
{
    public const string DeviceIdHeader = "X-INNO-Device-Id";
    public const string DeviceSecretHeader = "X-INNO-Device-Secret";

    public static string GenerateToken(string prefix)
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return prefix + "_" + Base64Url(bytes);
    }

    public static string HashSecret(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public bool HasMachineHeaders(HttpContext httpContext) =>
        httpContext.Request.Headers.ContainsKey(DeviceIdHeader)
        || httpContext.Request.Headers.ContainsKey(DeviceSecretHeader);

    public async Task<MachineAuthenticationResult> AuthenticateAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        Guid? expectedDeviceId,
        CancellationToken cancellationToken)
    {
        var rawDeviceId = httpContext.Request.Headers[DeviceIdHeader].FirstOrDefault();
        var secret = httpContext.Request.Headers[DeviceSecretHeader].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(rawDeviceId) || string.IsNullOrWhiteSpace(secret))
            return MachineAuthenticationResult.Failed("DEVICE_CREDENTIAL_REQUIRED");

        if (!OpaqueId.TryParse(rawDeviceId, "dev", out var deviceId))
            return MachineAuthenticationResult.Failed("DEVICE_CREDENTIAL_INVALID");

        if (expectedDeviceId is Guid expected && expected != deviceId)
            return MachineAuthenticationResult.Failed("DEVICE_CREDENTIAL_DEVICE_MISMATCH");

        var credential = await db.DeviceAgentCredentials
            .SingleOrDefaultAsync(
                x => x.DeviceId == deviceId && x.Status == "active",
                cancellationToken);
        if (credential is null)
            return MachineAuthenticationResult.Failed("DEVICE_CREDENTIAL_NOT_FOUND");

        var incoming = HashSecret(secret);
        var actualBytes = Encoding.ASCII.GetBytes(credential.SecretHash);
        var incomingBytes = Encoding.ASCII.GetBytes(incoming);
        if (actualBytes.Length != incomingBytes.Length
            || !CryptographicOperations.FixedTimeEquals(actualBytes, incomingBytes))
        {
            return MachineAuthenticationResult.Failed("DEVICE_CREDENTIAL_INVALID");
        }

        var device = await db.Devices.SingleOrDefaultAsync(x => x.Id == deviceId, cancellationToken);
        if (device is null)
            return MachineAuthenticationResult.Failed("DEVICE_NOT_FOUND");

        credential.LastAuthenticatedAt = DateTimeOffset.UtcNow;
        credential.Version++;
        await db.SaveChangesAsync(cancellationToken);
        return MachineAuthenticationResult.Succeeded(device, credential);
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
}

public sealed record MachineAuthenticationResult(
    bool Success,
    string? FailureCode,
    Device? Device,
    DeviceAgentCredential? Credential)
{
    public static MachineAuthenticationResult Failed(string code) =>
        new(false, code, null, null);

    public static MachineAuthenticationResult Succeeded(
        Device device,
        DeviceAgentCredential credential) =>
        new(true, null, device, credential);
}
