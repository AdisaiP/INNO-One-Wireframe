using System.Text.Json;
using INNO.One.Contracts.Automation;

namespace INNO.One.Modules.Workflows.Application;

public sealed record WorkflowExecutionNode(
    string Id,
    string Kind,
    string CatalogKey,
    string Label,
    string? LabelKey,
    JsonElement Configuration);

public sealed record WorkflowExecutionPlan(
    IReadOnlyList<WorkflowExecutionNode> Nodes);

public static class WorkflowExecutionPlanner
{
    private static readonly HashSet<string> CoreKinds =
    [
        "trigger",
        "wait",
        "end"
    ];

    public static bool TryCreate(
        string ownerModule,
        string nodesJson,
        string edgesJson,
        IEnumerable<IAutomationNodeExecutor> executors,
        out WorkflowExecutionPlan? plan,
        out string? errorCode,
        out string? errorDetail)
    {
        plan = null;
        errorCode = null;
        errorDetail = null;

        using var nodesDocument = JsonDocument.Parse(nodesJson);
        using var edgesDocument = JsonDocument.Parse(edgesJson);

        if (nodesDocument.RootElement.ValueKind != JsonValueKind.Array
            || edgesDocument.RootElement.ValueKind != JsonValueKind.Array)
        {
            return Fail("AUTOMATION_GRAPH_INVALID", "Automation graph must contain node and edge arrays.",
                out errorCode, out errorDetail);
        }

        var nodes = new Dictionary<string, WorkflowExecutionNode>(StringComparer.Ordinal);
        foreach (var element in nodesDocument.RootElement.EnumerateArray())
        {
            if (!TryString(element, "id", out var id)
                || !TryString(element, "kind", out var kind))
            {
                return Fail("AUTOMATION_GRAPH_INVALID", "Every node requires id and kind.",
                    out errorCode, out errorDetail);
            }

            if (element.TryGetProperty("disabled", out var disabled)
                && disabled.ValueKind == JsonValueKind.True)
            {
                return Fail("AUTOMATION_DISABLED_NODE", "Disabled nodes cannot be executed.",
                    out errorCode, out errorDetail);
            }

            var catalogKey = TryString(element, "catalogKey", out var parsedCatalogKey)
                ? parsedCatalogKey
                : kind switch
                {
                    "wait" => "workflow.wait",
                    "end" => "workflow.end",
                    _ => ""
                };

            if (string.IsNullOrWhiteSpace(catalogKey))
            {
                return Fail("AUTOMATION_CATALOG_KEY_REQUIRED",
                    "Every executable node requires a stable catalog key.",
                    out errorCode, out errorDetail);
            }

            var configuration = element.TryGetProperty("configuration", out var config)
                && config.ValueKind == JsonValueKind.Object
                ? config.Clone()
                : EmptyObject();

            var label = TryString(element, "label", out var parsedLabel)
                ? parsedLabel
                : id;
            var labelKey = TryString(element, "labelKey", out var parsedLabelKey)
                ? parsedLabelKey
                : null;

            if (!nodes.TryAdd(id, new WorkflowExecutionNode(
                id,
                kind,
                catalogKey,
                label,
                labelKey,
                configuration)))
            {
                return Fail("AUTOMATION_DUPLICATE_NODE",
                    "Automation node identifiers must be unique.",
                    out errorCode, out errorDetail);
            }
        }

        if (nodes.Count == 0)
        {
            return Fail("AUTOMATION_GRAPH_EMPTY", "Automation has no nodes.",
                out errorCode, out errorDetail);
        }

        var outgoing = nodes.Keys.ToDictionary(x => x, _ => new List<string>(), StringComparer.Ordinal);
        var incoming = nodes.Keys.ToDictionary(x => x, _ => new List<string>(), StringComparer.Ordinal);

        foreach (var edge in edgesDocument.RootElement.EnumerateArray())
        {
            if (!TryString(edge, "source", out var source)
                || !TryString(edge, "target", out var target)
                || !nodes.ContainsKey(source)
                || !nodes.ContainsKey(target))
            {
                return Fail("AUTOMATION_EDGE_INVALID",
                    "Every connection must reference existing source and target nodes.",
                    out errorCode, out errorDetail);
            }

            outgoing[source].Add(target);
            incoming[target].Add(source);
        }

        if (nodes.Values.Any(x => x.Kind is "branch" or "condition"))
        {
            return Fail("AUTOMATION_BRANCHING_NOT_SUPPORTED",
                "The shared runtime currently executes deterministic linear automations only. Branch and condition execution require a separately frozen contract.",
                out errorCode, out errorDetail);
        }

        if (outgoing.Values.Any(x => x.Count > 1) || incoming.Values.Any(x => x.Count > 1))
        {
            return Fail("AUTOMATION_BRANCHING_NOT_SUPPORTED",
                "The shared runtime currently executes one deterministic path per run.",
                out errorCode, out errorDetail);
        }

        var starts = nodes.Values.Where(x => incoming[x.Id].Count == 0).ToList();
        if (starts.Count != 1 || starts[0].Kind != "trigger")
        {
            return Fail("AUTOMATION_TRIGGER_REQUIRED",
                "Automation requires exactly one trigger at the start of the execution path.",
                out errorCode, out errorDetail);
        }

        var supportedExecutors = executors
            .Where(x => string.Equals(x.OwnerModule, ownerModule, StringComparison.OrdinalIgnoreCase))
            .ToList();

        foreach (var node in nodes.Values)
        {
            if (node.Kind == "wait" && !ValidWait(node.Configuration))
            {
                return Fail(
                    "AUTOMATION_WAIT_INVALID",
                    "Wait duration must be between 0 and 300 seconds.",
                    out errorCode,
                    out errorDetail);
            }

            if (CoreKinds.Contains(node.Kind))
            {
                continue;
            }

            var executor = supportedExecutors.FirstOrDefault(x => x.Supports(node.CatalogKey));
            if (executor is null)
            {
                return Fail("AUTOMATION_NODE_NOT_EXECUTABLE",
                    "Node '" + node.CatalogKey + "' does not have an execution provider for module '" + ownerModule + "'.",
                    out errorCode, out errorDetail);
            }

            var validation = executor.Validate(node.CatalogKey, node.Configuration);
            if (!validation.Valid)
            {
                return Fail(
                    validation.ErrorCode ?? "AUTOMATION_NODE_CONFIGURATION_INVALID",
                    validation.ErrorDetail ?? "The automation node configuration is invalid.",
                    out errorCode,
                    out errorDetail);
            }
        }

        var ordered = new List<WorkflowExecutionNode>(nodes.Count);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var current = starts[0];

        while (true)
        {
            if (!seen.Add(current.Id))
            {
                return Fail("AUTOMATION_CYCLE_NOT_SUPPORTED",
                    "Automation execution path contains a cycle.",
                    out errorCode, out errorDetail);
            }

            ordered.Add(current);
            var next = outgoing[current.Id];
            if (next.Count == 0)
            {
                break;
            }

            current = nodes[next[0]];
        }

        if (ordered.Count != nodes.Count)
        {
            return Fail("AUTOMATION_DISCONNECTED_GRAPH",
                "Every node must belong to the executable path.",
                out errorCode, out errorDetail);
        }

        if (ordered[^1].Kind != "end")
        {
            return Fail("AUTOMATION_END_REQUIRED",
                "Automation execution path must terminate with an End node.",
                out errorCode, out errorDetail);
        }

        plan = new WorkflowExecutionPlan(ordered);
        return true;
    }

    private static JsonElement EmptyObject()
    {
        using var document = JsonDocument.Parse("{}");
        return document.RootElement.Clone();
    }

    private static bool ValidWait(JsonElement configuration)
    {
        if (!configuration.TryGetProperty("durationSeconds", out var value))
        {
            return true;
        }

        return value.ValueKind == JsonValueKind.Number
            && value.TryGetInt32(out var seconds)
            && seconds is >= 0 and <= 300;
    }

    private static bool TryString(JsonElement element, string property, out string value)
    {
        value = "";
        if (!element.TryGetProperty(property, out var candidate)
            || candidate.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = candidate.GetString()?.Trim() ?? "";
        return value.Length > 0;
    }

    private static bool Fail(
        string code,
        string detail,
        out string? errorCode,
        out string? errorDetail)
    {
        errorCode = code;
        errorDetail = detail;
        return false;
    }
}
