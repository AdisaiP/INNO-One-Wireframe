namespace INNO.One.Contracts.Helpdesk;

public sealed record HelpdeskAutomationTicketRequest(
    Guid ActorUserId,
    string ActorSubject,
    Guid? RelatedAssetId,
    string Subject,
    string Description,
    string Priority,
    string IdempotencyKey,
    string CorrelationId,
    string? TraceId);

public sealed record HelpdeskAutomationTicketResult(
    bool Succeeded,
    bool Retryable,
    string? TicketId,
    string? TicketNumber,
    string? ErrorCode,
    string? ErrorDetail,
    bool IdempotentReplay)
{
    public static HelpdeskAutomationTicketResult Success(
        string ticketId,
        string ticketNumber,
        bool idempotentReplay) =>
        new(true, false, ticketId, ticketNumber, null, null, idempotentReplay);

    public static HelpdeskAutomationTicketResult Failure(
        string errorCode,
        string? errorDetail = null,
        bool retryable = false) =>
        new(false, retryable, null, null, errorCode, errorDetail, false);
}

public interface IHelpdeskAutomationTicketCreator
{
    Task<HelpdeskAutomationTicketResult> CreateAsync(
        HelpdeskAutomationTicketRequest request,
        CancellationToken cancellationToken = default);
}
