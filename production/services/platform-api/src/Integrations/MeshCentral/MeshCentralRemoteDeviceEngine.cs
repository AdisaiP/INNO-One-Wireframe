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

    public async Task<IReadOnlyList<RemoteProcessInfo>> ListProcessesAsync(
        string externalNodeId,
        CancellationToken cancellationToken = default)
    {
        EnsureEnabled();
        using var response = await SendAgentMessageAsync(
            externalNodeId,
            "ps",
            null,
            "ps",
            cancellationToken);

        var value = GetNullableString(response.RootElement, "value");
        return ParseProcesses(value);
    }

    public async Task<bool> TerminateProcessAsync(
        string externalNodeId,
        int processId,
        CancellationToken cancellationToken = default)
    {
        EnsureEnabled();
        if (processId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(processId));
        }

        using (await SendAgentMessageAsync(
            externalNodeId,
            "pskill",
            new Dictionary<string, object?> { ["value"] = processId.ToString() },
            null,
            cancellationToken))
        {
        }

        for (var attempt = 0; attempt < 10; attempt++)
        {
            await Task.Delay(TimeSpan.FromMilliseconds(300), cancellationToken);
            var processes = await ListProcessesAsync(externalNodeId, cancellationToken);
            if (processes.All(x => x.ProcessId != processId))
            {
                return true;
            }
        }

        return false;
    }

    public async Task<IReadOnlyList<RemoteServiceInfo>> ListServicesAsync(
        string externalNodeId,
        CancellationToken cancellationToken = default)
    {
        EnsureEnabled();
        using var response = await SendAgentMessageAsync(
            externalNodeId,
            "services",
            null,
            "services",
            cancellationToken);

        var value = GetNullableString(response.RootElement, "value");
        return ParseServices(value);
    }

    public async Task<bool> ExecuteServiceActionAsync(
        string externalNodeId,
        string serviceName,
        RemoteServiceAction action,
        CancellationToken cancellationToken = default)
    {
        EnsureEnabled();
        if (string.IsNullOrWhiteSpace(serviceName))
        {
            throw new ArgumentException("Service name is required.", nameof(serviceName));
        }

        var commandType = action switch
        {
            RemoteServiceAction.Start => "serviceStart",
            RemoteServiceAction.Stop => "serviceStop",
            RemoteServiceAction.Restart => "serviceRestart",
            _ => throw new ArgumentOutOfRangeException(nameof(action))
        };

        var initialServices = await ListServicesAsync(externalNodeId, cancellationToken);
        var initialService = initialServices.FirstOrDefault(x =>
            string.Equals(x.Name, serviceName, StringComparison.OrdinalIgnoreCase));
        var restartNeedsTransition = action == RemoteServiceAction.Restart
            && initialService is not null
            && IsRunningServiceState(initialService.Status);
        var restartTransitionObserved = !restartNeedsTransition;

        using (await SendAgentMessageAsync(
            externalNodeId,
            commandType,
            new Dictionary<string, object?> { ["serviceName"] = serviceName },
            null,
            cancellationToken))
        {
        }

        for (var attempt = 0; attempt < 20; attempt++)
        {
            await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken);
            var services = await ListServicesAsync(externalNodeId, cancellationToken);
            var service = services.FirstOrDefault(x =>
                string.Equals(x.Name, serviceName, StringComparison.OrdinalIgnoreCase));

            if (action == RemoteServiceAction.Restart)
            {
                if (service is null || !IsRunningServiceState(service.Status))
                {
                    restartTransitionObserved = true;
                    continue;
                }

                if (restartTransitionObserved && IsRunningServiceState(service.Status))
                {
                    return true;
                }

                continue;
            }

            if (service is not null && ServiceStateMatches(service.Status, action))
            {
                return true;
            }
        }

        return false;
    }

    private async Task<JsonDocument> SendAgentMessageAsync(
        string externalNodeId,
        string messageType,
        IReadOnlyDictionary<string, object?>? payload,
        string? expectedResponseType,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(externalNodeId))
        {
            throw new ArgumentException("External node ID is required.", nameof(externalNodeId));
        }

        var responseId = "inno-" + Guid.NewGuid().ToString("N");
        var command = new Dictionary<string, object?>
        {
            ["action"] = "msg",
            ["nodeid"] = externalNodeId,
            ["type"] = messageType,
            ["responseid"] = responseId
        };
        if (payload is not null)
        {
            foreach (var item in payload)
            {
                command[item.Key] = item.Value;
            }
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.CommandTimeoutSeconds, 2, 60)));

        try
        {
            using var socket = CreateSocket();
            await socket.ConnectAsync(BuildControlUri(), timeout.Token);

            var bytes = JsonSerializer.SerializeToUtf8Bytes(command);
            await socket.SendAsync(bytes, WebSocketMessageType.Text, true, timeout.Token);

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
                if (string.Equals(action, "msg", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(incomingResponseId, responseId, StringComparison.Ordinal))
                {
                    var result = GetNullableString(root, "result");
                    if (!string.Equals(result, "OK", StringComparison.OrdinalIgnoreCase))
                    {
                        document.Dispose();
                        throw new RemoteEngineUnavailableException(
                            $"MeshCentral could not route {messageType}: {result ?? "unknown response"}.");
                    }

                    if (expectedResponseType is null)
                    {
                        return document;
                    }

                    document.Dispose();
                    continue;
                }

                var incomingType = GetNullableString(root, "type");
                if (string.Equals(action, "msg", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(incomingType, expectedResponseType, StringComparison.OrdinalIgnoreCase))
                {
                    return document;
                }

                document.Dispose();
            }

            throw new RemoteEngineUnavailableException(
                $"MeshCentral closed the control connection while waiting for {messageType}.");
        }
        catch (RemoteEngineUnavailableException)
        {
            throw;
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new RemoteEngineUnavailableException(
                $"MeshCentral {messageType} command timed out after {_options.CommandTimeoutSeconds} seconds.",
                ex);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "MeshCentral agent message {MessageType} failed.", messageType);
            throw new RemoteEngineUnavailableException(
                $"MeshCentral could not execute {messageType}.",
                ex);
        }
    }

    private static IReadOnlyList<RemoteProcessInfo> ParseProcesses(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<RemoteProcessInfo>();
        }

        using var document = JsonDocument.Parse(json);
        var result = new List<RemoteProcessInfo>();

        if (document.RootElement.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (!int.TryParse(property.Name, out var pid)
                    || property.Value.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                result.Add(ToProcess(pid, property.Value));
            }
        }
        else if (document.RootElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in document.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var pid = GetNullableInt32(item, "pid")
                    ?? GetNullableInt32(item, "processId");
                if (pid is null)
                {
                    continue;
                }

                result.Add(ToProcess(pid.Value, item));
            }
        }

        return result.OrderByDescending(x => x.CpuPercent ?? -1).ThenBy(x => x.Name).ToArray();
    }

    private static RemoteProcessInfo ToProcess(int pid, JsonElement item)
    {
        var command = GetNullableString(item, "cmd")
            ?? GetNullableString(item, "command")
            ?? GetNullableString(item, "commandLine");
        var name = GetNullableString(item, "name")
            ?? GetNullableString(item, "processName")
            ?? command
            ?? $"PID {pid}";

        return new RemoteProcessInfo(
            pid,
            name,
            GetNullableString(item, "user") ?? GetNullableString(item, "username"),
            command,
            GetNullableDecimal(item, "cpu") ?? GetNullableDecimal(item, "cpuPercent"),
            GetNullableInt64(item, "memory")
                ?? GetNullableInt64(item, "workingSet")
                ?? GetNullableInt64(item, "workingSetSize"));
    }

    private static IReadOnlyList<RemoteServiceInfo> ParseServices(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<RemoteServiceInfo>();
        }

        using var document = JsonDocument.Parse(json);
        var result = new List<RemoteServiceInfo>();

        if (document.RootElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in document.RootElement.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    AddService(result, null, item);
                }
            }
        }
        else if (document.RootElement.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.Object)
                {
                    AddService(result, property.Name, property.Value);
                }
            }
        }

        return result.OrderBy(x => x.DisplayName ?? x.Name).ToArray();
    }

    private static void AddService(
        ICollection<RemoteServiceInfo> result,
        string? fallbackName,
        JsonElement item)
    {
        var name = GetNullableString(item, "name")
            ?? GetNullableString(item, "serviceName")
            ?? fallbackName;
        if (string.IsNullOrWhiteSpace(name))
        {
            return;
        }

        result.Add(new RemoteServiceInfo(
            name,
            GetNullableString(item, "displayName") ?? GetNullableString(item, "display"),
            GetNullableString(item, "status"),
            GetNullableString(item, "startType") ?? GetNullableString(item, "startupType"),
            GetNullableString(item, "user")));
    }

    private static bool IsRunningServiceState(string? status) =>
        !string.IsNullOrWhiteSpace(status)
        && (status.Contains("run", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "4", StringComparison.Ordinal));

    private static bool ServiceStateMatches(string? status, RemoteServiceAction action)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return false;
        }

        return action switch
        {
            RemoteServiceAction.Start => IsRunningServiceState(status),
            RemoteServiceAction.Stop => status.Contains("stop", StringComparison.OrdinalIgnoreCase)
                || string.Equals(status, "1", StringComparison.Ordinal),
            RemoteServiceAction.Restart => IsRunningServiceState(status),
            _ => false
        };
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

    private static long? GetNullableInt64(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Number
            && property.TryGetInt64(out var value))
        {
            return value;
        }

        if (property.ValueKind == JsonValueKind.String
            && long.TryParse(property.GetString(), out value))
        {
            return value;
        }

        return null;
    }

    private static decimal? GetNullableDecimal(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Number
            && property.TryGetDecimal(out var value))
        {
            return value;
        }

        if (property.ValueKind == JsonValueKind.String
            && decimal.TryParse(property.GetString(), out value))
        {
            return value;
        }

        return null;
    }
}
