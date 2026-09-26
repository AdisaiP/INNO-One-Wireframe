using System.Net.Security;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using INNO.One.Contracts.Integrations;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace INNO.One.Integrations.MeshCentral;

public sealed class MeshCentralRemoteDeviceEngine(
    IOptions<MeshCentralOptions> options,
    ILogger<MeshCentralRemoteDeviceEngine> logger) : IRemoteDeviceEngine
{
    private readonly MeshCentralOptions _options = options.Value;

    public bool IsEnabled => _options.Enabled;

    public async Task<IReadOnlyList<RemoteDeviceGroup>> ListGroupsAsync(
        CancellationToken cancellationToken = default)
    {
        EnsureEnabled();
        using var document = await SendAsync(
            new Dictionary<string, object?>
            {
                ["action"] = "meshes"
            },
            "meshes",
            cancellationToken,
            allowActionWithoutResponseId: true);

        if (!document.RootElement.TryGetProperty("meshes", out var meshes)
            || meshes.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<RemoteDeviceGroup>();
        }

        var result = new List<RemoteDeviceGroup>();
        foreach (var mesh in meshes.EnumerateArray())
        {
            var id = GetString(mesh, "_id");
            var name = GetString(mesh, "name");
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            result.Add(new RemoteDeviceGroup(
                id,
                name,
                GetNullableString(mesh, "desc")));
        }

        return result;
    }

    public async Task<RemoteDeviceGroup> CreateGroupAsync(
        string name,
        string? description,
        CancellationToken cancellationToken = default)
    {
        EnsureEnabled();

        var command = new Dictionary<string, object?>
        {
            ["action"] = "createmesh",
            ["meshname"] = name,
            ["meshtype"] = 2
        };
        if (!string.IsNullOrWhiteSpace(description))
        {
            command["desc"] = description;
        }

        using var response = await SendAsync(command, "createmesh", cancellationToken);
        EnsureOk(response.RootElement, "create MeshCentral device group");

        var externalId = GetString(response.RootElement, "meshid");
        if (string.IsNullOrWhiteSpace(externalId))
        {
            throw new RemoteEngineUnavailableException(
                "MeshCentral created the group without returning a group identifier.");
        }

        return new RemoteDeviceGroup(externalId, name, description);
    }

    public async Task UpdateGroupAsync(
        string externalGroupId,
        string name,
        string? description,
        CancellationToken cancellationToken = default)
    {
        EnsureEnabled();

        var command = new Dictionary<string, object?>
        {
            ["action"] = "editmesh",
            ["meshid"] = externalGroupId,
            ["meshname"] = name,
            ["desc"] = description ?? string.Empty
        };

        using var response = await SendAsync(command, "editmesh", cancellationToken);
        EnsureOk(response.RootElement, "update MeshCentral device group");
    }

    public async Task<IReadOnlyList<RemoteDeviceNode>> ListNodesAsync(
        CancellationToken cancellationToken = default)
    {
        EnsureEnabled();
        using var document = await SendAsync(
            new Dictionary<string, object?>
            {
                ["action"] = "nodes"
            },
            "nodes",
            cancellationToken);

        if (!document.RootElement.TryGetProperty("nodes", out var nodeGroups)
            || nodeGroups.ValueKind != JsonValueKind.Object)
        {
            return Array.Empty<RemoteDeviceNode>();
        }

        var result = new List<RemoteDeviceNode>();
        foreach (var groupProperty in nodeGroups.EnumerateObject())
        {
            if (groupProperty.Value.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var node in groupProperty.Value.EnumerateArray())
            {
                var id = GetString(node, "_id");
                var name = GetString(node, "name");
                if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }

                var externalGroupId = GetNullableString(node, "meshid") ?? groupProperty.Name;
                var connectionMask = GetInt32(node, "conn");
                string? agentVersion = null;
                if (node.TryGetProperty("agent", out var agent)
                    && agent.ValueKind == JsonValueKind.Object)
                {
                    agentVersion = GetNullableString(agent, "ver");
                }

                result.Add(new RemoteDeviceNode(
                    id,
                    externalGroupId,
                    name,
                    (connectionMask & 1) == 1,
                    GetNullableString(node, "ip"),
                    GetNullableString(node, "osdesc"),
                    agentVersion,
                    GetNullableInt32(node, "icon")));
            }
        }

        return result;
    }

    public async Task<RemoteEnrollmentLink> CreateEnrollmentLinkAsync(
        string externalGroupId,
        int expiresHours,
        CancellationToken cancellationToken = default)
    {
        EnsureEnabled();

        var safeHours = Math.Clamp(expiresHours, 1, 168);
        using var response = await SendAsync(
            new Dictionary<string, object?>
            {
                ["action"] = "createInviteLink",
                ["meshid"] = externalGroupId,
                ["expire"] = safeHours,
                ["flags"] = 0
            },
            "createInviteLink",
            cancellationToken);

        var url = GetNullableString(response.RootElement, "url");
        if (string.IsNullOrWhiteSpace(url))
        {
            var result = GetNullableString(response.RootElement, "result") ?? "unknown error";
            throw new RemoteEngineUnavailableException(
                $"MeshCentral could not create an enrollment link: {result}");
        }

        if (Uri.TryCreate(url, UriKind.Relative, out var relative))
        {
            var publicBase = ToHttpsBase(_options.BaseUrl);
            url = new Uri(publicBase, relative).ToString();
        }

        return new RemoteEnrollmentLink(
            url,
            DateTimeOffset.UtcNow.AddHours(safeHours));
    }

    private async Task<JsonDocument> SendAsync(
        Dictionary<string, object?> command,
        string expectedAction,
        CancellationToken cancellationToken,
        bool allowActionWithoutResponseId = false)
    {
        var responseId = "inno-" + Guid.NewGuid().ToString("N");
        command["responseid"] = responseId;

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.CommandTimeoutSeconds, 2, 60)));

        try
        {
            using var socket = CreateSocket();
            await socket.ConnectAsync(BuildControlUri(), timeout.Token);

            var payload = JsonSerializer.SerializeToUtf8Bytes(command);
            await socket.SendAsync(
                payload,
                WebSocketMessageType.Text,
                true,
                timeout.Token);

            while (socket.State == WebSocketState.Open)
            {
                var message = await ReceiveMessageAsync(socket, timeout.Token);
                if (string.IsNullOrWhiteSpace(message))
                {
                    continue;
                }

                var document = JsonDocument.Parse(message);
                var root = document.RootElement;
                var action = GetNullableString(root, "action");

                if (string.Equals(action, "close", StringComparison.OrdinalIgnoreCase))
                {
                    var cause = GetNullableString(root, "cause") ?? "unknown";
                    var msg = GetNullableString(root, "msg") ?? "connection closed";
                    document.Dispose();
                    throw new RemoteEngineUnavailableException(
                        $"MeshCentral closed the control connection: {cause} ({msg}).");
                }

                var incomingResponseId = GetNullableString(root, "responseid");
                if (string.Equals(action, expectedAction, StringComparison.OrdinalIgnoreCase)
                    && (string.Equals(incomingResponseId, responseId, StringComparison.Ordinal)
                        || (allowActionWithoutResponseId && string.IsNullOrWhiteSpace(incomingResponseId))))
                {
                    return document;
                }

                document.Dispose();
            }

            throw new RemoteEngineUnavailableException(
                "MeshCentral control connection closed before a response arrived.");
        }
        catch (RemoteEngineUnavailableException)
        {
            throw;
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new RemoteEngineUnavailableException(
                $"MeshCentral command timed out after {_options.CommandTimeoutSeconds} seconds.",
                ex);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "MeshCentral control request failed.");
            throw new RemoteEngineUnavailableException(
                "MeshCentral is unavailable or rejected the integration request.",
                ex);
        }
    }

    private ClientWebSocket CreateSocket()
    {
        var socket = new ClientWebSocket();
        var username = Convert.ToBase64String(Encoding.UTF8.GetBytes(_options.Username));
        var password = Convert.ToBase64String(Encoding.UTF8.GetBytes(_options.Password));
        socket.Options.SetRequestHeader("x-meshauth", username + "," + password);

        if (_options.AllowInvalidTls)
        {
            socket.Options.RemoteCertificateValidationCallback =
                static (_, _, _, _) => true;
        }

        return socket;
    }

    private Uri BuildControlUri()
    {
        var baseUrl = _options.BaseUrl.Trim().TrimEnd('/');
        if (baseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            baseUrl = "wss://" + baseUrl[8..];
        }
        else if (baseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
        {
            baseUrl = "ws://" + baseUrl[7..];
        }

        if (!baseUrl.StartsWith("wss://", StringComparison.OrdinalIgnoreCase)
            && !baseUrl.StartsWith("ws://", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("MeshCentral:BaseUrl must use ws/wss/http/https.");
        }

        return new Uri(baseUrl + "/control.ashx");
    }

    private static Uri ToHttpsBase(string configured)
    {
        var value = configured.Trim().TrimEnd('/') + "/";
        if (value.StartsWith("wss://", StringComparison.OrdinalIgnoreCase))
        {
            value = "https://" + value[6..];
        }
        else if (value.StartsWith("ws://", StringComparison.OrdinalIgnoreCase))
        {
            value = "http://" + value[5..];
        }

        return new Uri(value);
    }

    private static async Task<string> ReceiveMessageAsync(
        ClientWebSocket socket,
        CancellationToken cancellationToken)
    {
        var buffer = new byte[16 * 1024];
        using var stream = new MemoryStream();

        while (true)
        {
            var result = await socket.ReceiveAsync(buffer, cancellationToken);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                return string.Empty;
            }

            stream.Write(buffer, 0, result.Count);
            if (result.EndOfMessage)
            {
                return Encoding.UTF8.GetString(stream.ToArray());
            }

            if (stream.Length > 4 * 1024 * 1024)
            {
                throw new RemoteEngineUnavailableException(
                    "MeshCentral returned an unexpectedly large control message.");
            }
        }
    }

    private static void EnsureOk(JsonElement root, string operation)
    {
        var result = GetNullableString(root, "result");
        if (!string.Equals(result, "OK", StringComparison.OrdinalIgnoreCase))
        {
            throw new RemoteEngineUnavailableException(
                $"Unable to {operation}: {result ?? "unknown MeshCentral response"}.");
        }
    }

    private void EnsureEnabled()
    {
        if (!_options.Enabled)
        {
            throw new RemoteEngineUnavailableException(
                "MeshCentral integration is disabled for this environment.");
        }

        if (string.IsNullOrWhiteSpace(_options.Username)
            || string.IsNullOrWhiteSpace(_options.Password))
        {
            throw new RemoteEngineUnavailableException(
                "MeshCentral integration credentials are not configured.");
        }
    }

    private static string GetString(JsonElement element, string name) =>
        GetNullableString(element, name) ?? string.Empty;

    private static string? GetNullableString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property))
        {
            return null;
        }

        return property.ValueKind switch
        {
            JsonValueKind.String => property.GetString(),
            JsonValueKind.Number => property.GetRawText(),
            _ => null
        };
    }

    private static int GetInt32(JsonElement element, string name) =>
        GetNullableInt32(element, name) ?? 0;

    private static int? GetNullableInt32(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Number
            && property.TryGetInt32(out var value))
        {
            return value;
        }

        if (property.ValueKind == JsonValueKind.String
            && int.TryParse(property.GetString(), out value))
        {
            return value;
        }

        return null;
    }
}
