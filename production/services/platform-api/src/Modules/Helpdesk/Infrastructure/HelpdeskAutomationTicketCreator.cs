using System.Security.Claims;
using System.Security.Cryptography;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Helpdesk;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Helpdesk.Domain;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Infrastructure;

public sealed class HelpdeskAutomationTicketCreator(
    HelpdeskDbContext db,
    IAccessEvaluator accessEvaluator,
    IPlatformDirectoryReader directoryReader,
    HelpdeskLedgerWriter ledger,
    BusinessTimeCalculator businessTime) : IHelpdeskAutomationTicketCreator
{
    public async Task<HelpdeskAutomationTicketResult> CreateAsync(
        HelpdeskAutomationTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Subject)
            || request.Subject.Trim().Length > 240)
        {
            return HelpdeskAutomationTicketResult.Failure(
                "HELPDESK_AUTOMATION_SUBJECT_INVALID",
                "Helpdesk ticket subject is required and must be 240 characters or fewer.");
        }

        if (string.IsNullOrWhiteSpace(request.Description)
            || request.Description.Trim().Length > 12000)
        {
            return HelpdeskAutomationTicketResult.Failure(
                "HELPDESK_AUTOMATION_DESCRIPTION_INVALID",
                "Helpdesk ticket description is required and must be 12000 characters or fewer.");
        }

        var priority = request.Priority.Trim().ToUpperInvariant();
        if (priority is not ("P1" or "P2" or "P3" or "P4"))
        {
            return HelpdeskAutomationTicketResult.Failure(
                "HELPDESK_AUTOMATION_PRIORITY_INVALID",
                "Helpdesk ticket priority must be P1, P2, P3 or P4.");
        }

        var principal = new ClaimsPrincipal(
            new ClaimsIdentity(
                [new Claim("sub", request.ActorSubject)],
                "automation-worker"));
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "helpdesk.ticket.create",
            cancellationToken);
        if (!access.Allowed || access.UserId != request.ActorUserId)
        {
            return HelpdeskAutomationTicketResult.Failure(
                "HELPDESK_CREATE_PERMISSION_DENIED",
                "The automation actor does not currently have Helpdesk ticket creation permission.");
        }

        var marker = "Automation " + request.IdempotencyKey;
        var existingHistory = await db.TicketStatusHistory.AsNoTracking()
            .Where(x => x.Note == marker)
            .OrderByDescending(x => x.ChangedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (existingHistory is not null)
        {
            var existingTicket = await db.Tickets.AsNoTracking()
                .SingleOrDefaultAsync(
                    x => x.Id == existingHistory.TicketId,
                    cancellationToken);
            if (existingTicket is not null)
            {
                return HelpdeskAutomationTicketResult.Success(
                    OpaqueId.Format("ticket", existingTicket.Id),
                    existingTicket.TicketNumber,
                    idempotentReplay: true);
            }
        }

        var users = await directoryReader.ReadUsersAsync(
            [access.UserId],
            cancellationToken);
        if (!users.TryGetValue(access.UserId, out var requester))
        {
            return HelpdeskAutomationTicketResult.Failure(
                "HELPDESK_REQUESTER_NOT_FOUND",
                "The automation actor does not have an active platform requester profile.");
        }

        var openStatus = await db.Statuses.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Code == "open" && x.Status == "active",
                cancellationToken);
        var slaPolicy = await db.SlaPolicies.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Priority == priority && x.IsActive,
                cancellationToken);
        if (openStatus is null || slaPolicy is null)
        {
            return HelpdeskAutomationTicketResult.Failure(
                "HELPDESK_CONFIGURATION_UNAVAILABLE",
                "Helpdesk open status or SLA policy is unavailable.");
        }

        var now = DateTimeOffset.UtcNow;
        var calendarId = slaPolicy.BusinessCalendarId
            ?? await businessTime.GetDefaultCalendarIdAsync(cancellationToken);
        var responseDueAt = await businessTime.AddBusinessMinutesAsync(
            now,
            slaPolicy.ResponseMinutes,
            calendarId,
            cancellationToken);
        var resolutionDueAt = await businessTime.AddBusinessMinutesAsync(
            now,
            slaPolicy.ResolutionMinutes,
            calendarId,
            cancellationToken);

        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            TicketNumber = await GenerateTicketNumberAsync(now.Year, cancellationToken),
            Subject = request.Subject.Trim(),
            Description = request.Description.Trim(),
            RequesterUserId = access.UserId,
            RequesterOrganizationUnitId = requester.OrganizationUnitId,
            CategoryId = null,
            StatusId = openStatus.Id,
            Priority = priority,
            Impact = "Individual",
            Urgency = "Normal",
            RelatedDeviceId = null,
            RelatedAssetId = request.RelatedAssetId,
            CreatedAt = now,
            UpdatedAt = now
        };

        var ticketSla = new TicketSla
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            PolicyId = slaPolicy.Id,
            ResponseDueAt = responseDueAt.ToUniversalTime(),
            ResolutionDueAt = resolutionDueAt.ToUniversalTime(),
            State = "active",
            UpdatedAt = now
        };

        var history = new TicketStatusHistory
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            FromStatusId = null,
            ToStatusId = openStatus.Id,
            ChangedByUserId = access.UserId,
            Note = marker,
            ChangedAt = now
        };

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        db.Tickets.Add(ticket);
        db.TicketSla.Add(ticketSla);
        db.TicketStatusHistory.Add(history);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            return HelpdeskAutomationTicketResult.Failure(
                "HELPDESK_AUTOMATION_WRITE_FAILED",
                "The Helpdesk ticket could not be persisted.",
                retryable: true);
        }

        var publicTicketId = OpaqueId.Format("ticket", ticket.Id);
        var actorId = OpaqueId.Format("user", access.UserId);

        await ledger.AppendAuditAsync(
            "helpdesk.ticket.automation_created",
            "ticket",
            publicTicketId,
            actorId,
            request.CorrelationId,
            request.TraceId,
            new
            {
                ticket.TicketNumber,
                ticket.Priority,
                relatedAssetId = request.RelatedAssetId.HasValue
                    ? OpaqueId.Format("asset", request.RelatedAssetId.Value)
                    : null,
                automationIdempotencyKey = request.IdempotencyKey
            },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "ticket.created",
            "ticket",
            publicTicketId,
            new
            {
                ticketId = publicTicketId,
                ticketNumber = ticket.TicketNumber,
                requesterUserId = actorId,
                priority = ticket.Priority,
                relatedAssetId = request.RelatedAssetId.HasValue
                    ? OpaqueId.Format("asset", request.RelatedAssetId.Value)
                    : null,
                automationIdempotencyKey = request.IdempotencyKey
            },
            request.CorrelationId,
            request.IdempotencyKey,
            request.TraceId,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return HelpdeskAutomationTicketResult.Success(
            publicTicketId,
            ticket.TicketNumber,
            idempotentReplay: false);
    }

    private async Task<string> GenerateTicketNumberAsync(
        int year,
        CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 8; attempt++)
        {
            var number = $"HD-{year}-{RandomNumberGenerator.GetInt32(1, 1_000_000):D6}";
            if (!await db.Tickets.AsNoTracking().AnyAsync(
                x => x.TicketNumber == number,
                cancellationToken))
            {
                return number;
            }
        }

        return $"HD-{year}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";
    }
}
