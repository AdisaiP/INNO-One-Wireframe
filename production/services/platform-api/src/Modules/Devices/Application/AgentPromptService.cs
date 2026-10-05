using INNO.One.Contracts.Agent;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Application;

public sealed class AgentPromptService(
    DevicesDbContext db,
    DeviceLedgerWriter ledger) : IAgentPromptService
{
    public async Task<AgentPromptCreateResult> CreateAsync(
        AgentPromptCreateRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.SourceModule))
            throw new ArgumentException("Source module is required.", nameof(request));
        if (string.IsNullOrWhiteSpace(request.PromptType))
            throw new ArgumentException("Prompt type is required.", nameof(request));
        if (string.IsNullOrWhiteSpace(request.TitleTh)
            || string.IsNullOrWhiteSpace(request.TitleEn)
            || string.IsNullOrWhiteSpace(request.MessageTh)
            || string.IsNullOrWhiteSpace(request.MessageEn))
            throw new ArgumentException("Bilingual prompt title and message are required.", nameof(request));
        if (request.ExpiresAt <= DateTimeOffset.UtcNow)
            throw new ArgumentException("Prompt expiry must be in the future.", nameof(request));

        var deviceExists = await db.Devices.AsNoTracking()
            .AnyAsync(x => x.Id == request.DeviceId, cancellationToken);
        if (!deviceExists)
            throw new InvalidOperationException("Target device was not found.");

        var now = DateTimeOffset.UtcNow;
        var prompt = new AgentPrompt
        {
            Id = Guid.NewGuid(),
            DeviceId = request.DeviceId,
            RequestedByUserId = request.RequestedByUserId,
            SourceModule = request.SourceModule.Trim().ToLowerInvariant(),
            SourceReference = string.IsNullOrWhiteSpace(request.SourceReference)
                ? null
                : request.SourceReference.Trim(),
            PromptType = request.PromptType.Trim().ToLowerInvariant(),
            TitleTh = request.TitleTh.Trim(),
            TitleEn = request.TitleEn.Trim(),
            MessageTh = request.MessageTh.Trim(),
            MessageEn = request.MessageEn.Trim(),
            Status = "pending",
            CreatedAt = now,
            ExpiresAt = request.ExpiresAt,
            Version = 1
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.AgentPrompts.Add(prompt);
        await db.SaveChangesAsync(cancellationToken);

        var promptId = OpaqueId.Format("prompt", prompt.Id);
        await ledger.AppendAuditAsync(
            "devices.agent.prompt_created",
            "agent_prompt",
            promptId,
            OpaqueId.Format("user", request.RequestedByUserId),
            request.CorrelationId,
            request.TraceId,
            new
            {
                deviceId = OpaqueId.Format("dev", request.DeviceId),
                prompt.SourceModule,
                prompt.SourceReference,
                prompt.PromptType,
                prompt.ExpiresAt
            },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "agent.prompt.created",
            "agent_prompt",
            promptId,
            new
            {
                promptId,
                deviceId = OpaqueId.Format("dev", request.DeviceId),
                prompt.SourceModule,
                prompt.SourceReference,
                prompt.PromptType,
                prompt.ExpiresAt
            },
            request.CorrelationId,
            null,
            request.TraceId,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return new AgentPromptCreateResult(prompt.Id, prompt.Status, prompt.ExpiresAt);
    }
}
