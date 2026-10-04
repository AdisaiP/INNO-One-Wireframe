using System.Text.Json;

namespace INNO.One.Contracts.Automation;

public sealed record AutomationNodeExecutionContext(
    string OwnerModule,
    Guid RunId,
    Guid WorkflowId,
    long WorkflowVersion,
    string NodeId,
    string NodeKind,
    string CatalogKey,
    JsonElement Configuration,
    JsonElement Input,
    Guid ActorUserId,
    string ActorSubject,
    string CorrelationId,
    string? TraceId,
    int Attempt);

public sealed record AutomationNodeExecutionResult(
    bool Succeeded,
    bool Retryable,
    string? ErrorCode,
    string? ErrorDetail,
    JsonElement? Output = null)
{
    public static AutomationNodeExecutionResult Success(JsonElement? output = null) =>
        new(true, false, null, null, output);

    public static AutomationNodeExecutionResult Failure(
        string errorCode,
        string? errorDetail = null,
        bool retryable = false) =>
        new(false, retryable, errorCode, errorDetail, null);
}

public sealed record AutomationNodeValidationResult(
    bool Valid,
    string? ErrorCode,
    string? ErrorDetail)
{
    public static AutomationNodeValidationResult Success() => new(true, null, null);

    public static AutomationNodeValidationResult Failure(string errorCode, string errorDetail) =>
        new(false, errorCode, errorDetail);
}

public interface IAutomationNodeExecutor
{
    string OwnerModule { get; }

    bool Supports(string catalogKey);

    AutomationNodeValidationResult Validate(
        string catalogKey,
        JsonElement configuration);

    Task<AutomationNodeExecutionResult> ExecuteAsync(
        AutomationNodeExecutionContext context,
        CancellationToken cancellationToken = default);
}
