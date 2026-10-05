namespace INNO.One.Contracts.Agent;

public sealed record AgentPromptCreateRequest(
    Guid DeviceId,
    Guid RequestedByUserId,
    string SourceModule,
    string? SourceReference,
    string PromptType,
    string TitleTh,
    string TitleEn,
    string MessageTh,
    string MessageEn,
    string CorrelationId,
    string? TraceId,
    DateTimeOffset ExpiresAt);

public sealed record AgentPromptCreateResult(
    Guid PromptId,
    string Status,
    DateTimeOffset ExpiresAt);

public interface IAgentPromptService
{
    Task<AgentPromptCreateResult> CreateAsync(
        AgentPromptCreateRequest request,
        CancellationToken cancellationToken = default);
}
