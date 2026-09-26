using System.Security.Cryptography;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Helpdesk.Domain;
using INNO.One.Modules.Helpdesk.Infrastructure;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Api;

public static class HelpdeskEndpoints
{
    public static RouteGroupBuilder MapHelpdeskEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/helpdesk/overview", GetOverviewAsync)
            .WithName("helpdesk.overview.get");

        api.MapGet("/helpdesk/tickets", ListTicketsAsync)
            .WithName("helpdesk.tickets.list");

        api.MapGet("/helpdesk/tickets/{ticketId}", GetTicketAsync)
            .WithName("helpdesk.tickets.get");

        api.MapPost("/helpdesk/tickets", CreateTicketAsync)
            .WithName("helpdesk.tickets.create");

        api.MapPost("/helpdesk/tickets/{ticketId}/replies", ReplyAsync)
            .WithName("helpdesk.tickets.reply");

        api.MapPost("/helpdesk/tickets/{ticketId}/assignment", ReassignAsync)
            .WithName("helpdesk.tickets.reassign");

        api.MapPost("/helpdesk/tickets/{ticketId}/resolve", ResolveAsync)
            .WithName("helpdesk.tickets.resolve");

        api.MapGet("/helpdesk/categories/tree", GetCategoriesAsync)
            .WithName("helpdesk.categories.tree");

        api.MapGet("/helpdesk/statuses", GetStatusesAsync)
            .WithName("helpdesk.statuses.list");

        return api;
    }

    private static async Task<IResult> GetOverviewAsync(
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var openStatusIds = await db.Statuses.AsNoTracking()
            .Where(x => !x.IsClosed && x.Status == "active")
            .Select(x => x.Id)
            .ToArrayAsync(cancellationToken);

        var query = ApplyTicketScope(
            db.Tickets.AsNoTracking().Where(x => openStatusIds.Contains(x.StatusId)),
            access);

        var openTickets = await query.CountAsync(cancellationToken);
        var assignedToMe = await query.CountAsync(
            x => x.AssigneeUserId == access.UserId,
            cancellationToken);
        var unassigned = await query.CountAsync(
            x => x.AssigneeUserId == null,
            cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var slaRows = await (
            from ticket in query
            join sla in db.TicketSla.AsNoTracking() on ticket.Id equals sla.TicketId
            select new { ticket.Id, sla.ResolutionDueAt, sla.State }
        ).ToListAsync(cancellationToken);

        var dueToday = slaRows.Count(x =>
            x.ResolutionDueAt >= now
            && x.ResolutionDueAt < now.AddHours(24));
        var atRisk = slaRows.Count(x =>
            x.State == "at_risk"
            || (x.ResolutionDueAt > now
                && x.ResolutionDueAt <= now.AddMinutes(90)));
        var breached = slaRows.Count(x =>
            x.State == "breached"
            || x.ResolutionDueAt <= now);

        var priorityRows = await BuildTicketSummariesAsync(
            query
                .OrderBy(x => x.Priority)
                .ThenBy(x => x.CreatedAt)
                .Take(5),
            db,
            directoryReader,
            cancellationToken);

        var mineRows = await BuildTicketSummariesAsync(
            query
                .Where(x => x.AssigneeUserId == access.UserId)
                .OrderByDescending(x => x.UpdatedAt)
                .Take(5),
            db,
            directoryReader,
            cancellationToken);

        return Results.Ok(new ResourceResponse<HelpdeskOverviewResponse>(
            new(
                openTickets,
                assignedToMe,
                unassigned,
                dueToday,
                atRisk,
                breached,
                priorityRows,
                mineRows)));
    }

    private static async Task<IResult> ListTicketsAsync(
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        int page = 1,
        int pageSize = 25,
        string? search = null,
        string? status = null,
        string? priority = null,
        bool assignedToMe = false,
        bool unassigned = false,
        string? sort = "updatedAt",
        string? order = "desc",
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = ApplyTicketScope(db.Tickets.AsNoTracking(), access);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.TicketNumber.ToLower().Contains(term)
                || x.Subject.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query =
                from ticket in query
                join ticketStatus in db.Statuses.AsNoTracking()
                    on ticket.StatusId equals ticketStatus.Id
                where ticketStatus.Code == normalizedStatus
                select ticket;
        }

        if (!string.IsNullOrWhiteSpace(priority)
            && !string.Equals(priority, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedPriority = priority.Trim().ToUpperInvariant();
            query = query.Where(x => x.Priority == normalizedPriority);
        }

        if (assignedToMe)
        {
            query = query.Where(x => x.AssigneeUserId == access.UserId);
        }

        if (unassigned)
        {
            query = query.Where(x => x.AssigneeUserId == null);
        }

        var totalItems = await query.CountAsync(cancellationToken);
        query = ApplyTicketSort(query, sort, order);

        var pageQuery = query
            .Skip((page - 1) * pageSize)
            .Take(pageSize);

        var items = await BuildTicketSummariesAsync(
            pageQuery,
            db,
            directoryReader,
            cancellationToken);

        var totalPages = totalItems == 0
            ? 0
            : (int)Math.Ceiling(totalItems / (double)pageSize);

        return Results.Ok(new PagedResponse<TicketSummaryResponse>(
            items,
            page,
            pageSize,
            totalItems,
            totalPages));
    }

    private static async Task<IResult> GetTicketAsync(
        string ticketId,
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        IDeviceDirectoryReader deviceDirectoryReader,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(ticketId, "ticket", out var id))
        {
            return NotFound("Ticket not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var ticket = await db.Tickets.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (ticket is null)
        {
            return NotFound("Ticket not found.");
        }

        if (!CanAccessTicket(access, ticket))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        var status = await db.Statuses.AsNoTracking()
            .SingleAsync(x => x.Id == ticket.StatusId, cancellationToken);
        var category = ticket.CategoryId.HasValue
            ? await db.Categories.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == ticket.CategoryId.Value, cancellationToken)
            : null;
        Category? parentCategory = null;
        if (category?.ParentCategoryId is Guid parentId)
        {
            parentCategory = await db.Categories.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == parentId, cancellationToken);
        }

        var replies = await db.TicketReplies.AsNoTracking()
            .Where(x => x.TicketId == id)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var assignments = await db.TicketAssignments.AsNoTracking()
            .Where(x => x.TicketId == id)
            .OrderBy(x => x.AssignedAt)
            .ToListAsync(cancellationToken);

        var statusHistory = await db.TicketStatusHistory.AsNoTracking()
            .Where(x => x.TicketId == id)
            .OrderBy(x => x.ChangedAt)
            .ToListAsync(cancellationToken);

        var sla = await (
            from ticketSla in db.TicketSla.AsNoTracking()
            join policy in db.SlaPolicies.AsNoTracking()
                on ticketSla.PolicyId equals policy.Id
            where ticketSla.TicketId == id
            select new { TicketSla = ticketSla, Policy = policy }
        ).SingleOrDefaultAsync(cancellationToken);

        var userIds = new HashSet<Guid>
        {
            ticket.RequesterUserId
        };
        if (ticket.AssigneeUserId.HasValue)
        {
            userIds.Add(ticket.AssigneeUserId.Value);
        }
        foreach (var reply in replies)
        {
            userIds.Add(reply.AuthorUserId);
        }
        foreach (var assignment in assignments)
        {
            userIds.Add(assignment.AssignedByUserId);
            if (assignment.AssigneeUserId.HasValue)
            {
                userIds.Add(assignment.AssigneeUserId.Value);
            }
        }
        foreach (var history in statusHistory)
        {
            userIds.Add(history.ChangedByUserId);
        }

        var orgIds = ticket.RequesterOrganizationUnitId.HasValue
            ? new[] { ticket.RequesterOrganizationUnitId.Value }
            : Array.Empty<Guid>();

        var directory = await directoryReader.ReadAsync(
            userIds,
            orgIds,
            Array.Empty<Guid>(),
            cancellationToken);

        var relatedDevice = default(DeviceReferenceResponse);
        if (ticket.RelatedDeviceId is Guid deviceId)
        {
            var devices = await deviceDirectoryReader.ReadAsync(
                new[] { deviceId },
                cancellationToken);
            if (devices.TryGetValue(deviceId, out var device))
            {
                relatedDevice = new DeviceReferenceResponse(
                    OpaqueId.Format("dev", device.Id),
                    device.Name,
                    device.Status,
                    device.OperatingSystem);
            }
        }

        var assigneeOptions = await directoryReader.SearchUsersAsync(
            null,
            null,
            50,
            cancellationToken);

        var historyStatusIds = statusHistory
            .SelectMany(x => x.FromStatusId.HasValue
                ? new[] { x.FromStatusId.Value, x.ToStatusId }
                : new[] { x.ToStatusId })
            .Distinct()
            .ToArray();
        var statusNames = await db.Statuses.AsNoTracking()
            .Where(x => historyStatusIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var messages = new List<TicketMessageResponse>
        {
            new(
                OpaqueId.Format("msg", ticket.Id),
                OpaqueId.Format("user", ticket.RequesterUserId),
                directory.Users.GetValueOrDefault(ticket.RequesterUserId) ?? "Requester",
                ticket.Description,
                "public",
                true,
                ticket.CreatedAt)
        };
        messages.AddRange(replies.Select(reply => new TicketMessageResponse(
            OpaqueId.Format("reply", reply.Id),
            OpaqueId.Format("user", reply.AuthorUserId),
            directory.Users.GetValueOrDefault(reply.AuthorUserId) ?? "User",
            reply.Body,
            reply.Visibility,
            reply.AuthorUserId == ticket.RequesterUserId,
            reply.CreatedAt)));

        var activities = new List<TicketActivityResponse>();
        activities.AddRange(assignments.Select(x => new TicketActivityResponse(
            OpaqueId.Format("activity", x.Id),
            "assignment",
            x.AssigneeUserId.HasValue
                ? $"Assigned to {directory.Users.GetValueOrDefault(x.AssigneeUserId.Value) ?? x.Team ?? "support"}"
                : $"Assigned to {x.Team ?? "queue"}",
            x.Note,
            x.AssignedAt)));
        activities.AddRange(statusHistory.Select(x => new TicketActivityResponse(
            OpaqueId.Format("activity", x.Id),
            "status",
            x.FromStatusId.HasValue
                ? $"Status changed to {statusNames.GetValueOrDefault(x.ToStatusId) ?? "Updated"}"
                : "Ticket created",
            x.Note,
            x.ChangedAt)));
        activities = activities.OrderByDescending(x => x.OccurredAt).ToList();

        var elapsedPercent = sla is null
            ? 0
            : CalculateElapsedPercent(
                ticket.CreatedAt,
                sla.TicketSla.ResolutionDueAt,
                ticket.ResolvedAt ?? DateTimeOffset.UtcNow);

        var response = new TicketDetailResponse(
            ticketId,
            ticket.TicketNumber,
            ticket.Subject,
            status.Code,
            status.Name,
            ticket.Priority,
            ticket.Impact,
            ticket.Urgency,
            new UserReferenceResponse(
                OpaqueId.Format("user", ticket.RequesterUserId),
                directory.Users.GetValueOrDefault(ticket.RequesterUserId) ?? "Requester"),
            ticket.RequesterOrganizationUnitId is Guid organizationId
                ? new ReferenceResponse(
                    OpaqueId.Format("org", organizationId),
                    directory.Organizations.GetValueOrDefault(organizationId) ?? "Organization")
                : null,
            ticket.AssigneeUserId is Guid assigneeId
                ? new UserReferenceResponse(
                    OpaqueId.Format("user", assigneeId),
                    directory.Users.GetValueOrDefault(assigneeId) ?? "Assignee")
                : null,
            ticket.AssigneeTeam,
            category is null
                ? null
                : new CategoryReferenceResponse(
                    OpaqueId.Format("cat", category.Id),
                    category.Code,
                    parentCategory is null
                        ? category.Name
                        : parentCategory.Name + " / " + category.Name),
            relatedDevice,
            ticket.RelatedAssetId.HasValue
                ? OpaqueId.Format("asset", ticket.RelatedAssetId.Value)
                : null,
            messages,
            activities,
            sla is null
                ? null
                : new TicketSlaResponse(
                    OpaqueId.Format("sla", sla.Policy.Id),
                    sla.Policy.Name,
                    sla.Policy.ResponseMinutes,
                    sla.Policy.ResolutionMinutes,
                    sla.TicketSla.ResponseDueAt,
                    sla.TicketSla.ResolutionDueAt,
                    sla.TicketSla.ResponseMetAt,
                    sla.TicketSla.State,
                    elapsedPercent),
            assigneeOptions.Select(x => new UserReferenceResponse(
                OpaqueId.Format("user", x.Id),
                x.FullName)).ToList(),
            ticket.ResolvedAt,
            ticket.ResolutionCode,
            ticket.CreatedAt,
            ticket.UpdatedAt,
            Etag(ticket.Version));

        httpContext.Response.Headers.ETag = Etag(ticket.Version);
        return Results.Ok(new ResourceResponse<TicketDetailResponse>(response));
    }

    private static async Task<IResult> CreateTicketAsync(
        CreateTicketRequest request,
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        IDeviceDirectoryReader deviceDirectoryReader,
        HelpdeskLedgerWriter ledger,
        BusinessTimeCalculator businessTime,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.create",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        if (string.IsNullOrWhiteSpace(request.Subject))
        {
            return Validation("subject", "Subject is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return Validation("description", "Description is required.");
        }

        var users = await directoryReader.ReadUsersAsync(
            new[] { access.UserId },
            cancellationToken);
        if (!users.TryGetValue(access.UserId, out var requester))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Requester profile not found");
        }

        Guid? categoryId = null;
        if (!string.IsNullOrWhiteSpace(request.CategoryId))
        {
            if (!OpaqueId.TryParse(request.CategoryId, "cat", out var parsedCategoryId)
                || !await db.Categories.AsNoTracking().AnyAsync(
                    x => x.Id == parsedCategoryId
                        && x.Status == "active",
                    cancellationToken))
            {
                return Validation("categoryId", "Select an active Helpdesk category.");
            }
            categoryId = parsedCategoryId;
        }

        Guid? relatedDeviceId = null;
        if (!string.IsNullOrWhiteSpace(request.RelatedDeviceId))
        {
            if (!OpaqueId.TryParse(request.RelatedDeviceId, "dev", out var parsedDeviceId))
            {
                return Validation("relatedDeviceId", "Invalid related Device.");
            }

            var deviceAccess = await accessEvaluator.EvaluateAsync(
                httpContext.User,
                "devices.view",
                cancellationToken);
            if (!deviceAccess.Allowed)
            {
                return Forbidden("RELATED_DEVICE_NOT_ACCESSIBLE");
            }

            var devices = await deviceDirectoryReader.ReadAsync(
                new[] { parsedDeviceId },
                cancellationToken);
            if (!devices.TryGetValue(parsedDeviceId, out var device)
                || !CanAccessDevice(deviceAccess, device))
            {
                return Forbidden("RELATED_DEVICE_NOT_ACCESSIBLE");
            }

            relatedDeviceId = parsedDeviceId;
        }

        var priority = NormalizePriority(
            request.Priority,
            request.Impact,
            request.Urgency);
        var impact = NormalizeImpact(request.Impact);
        var urgency = NormalizeUrgency(request.Urgency);

        var openStatus = await db.Statuses.AsNoTracking()
            .SingleAsync(x => x.Code == "open" && x.Status == "active", cancellationToken);
        var slaPolicy = await db.SlaPolicies.AsNoTracking()
            .SingleAsync(x => x.Priority == priority && x.IsActive, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            TicketNumber = await GenerateTicketNumberAsync(db, now.Year, cancellationToken),
            Subject = request.Subject.Trim(),
            Description = request.Description.Trim(),
            RequesterUserId = access.UserId,
            RequesterOrganizationUnitId = requester.OrganizationUnitId,
            CategoryId = categoryId,
            StatusId = openStatus.Id,
            Priority = priority,
            Impact = impact,
            Urgency = urgency,
            RelatedDeviceId = relatedDeviceId,
            CreatedAt = now,
            UpdatedAt = now
        };

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
            Note = "Ticket created",
            ChangedAt = now
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.Tickets.Add(ticket);
        db.TicketSla.Add(ticketSla);
        db.TicketStatusHistory.Add(history);
        await db.SaveChangesAsync(cancellationToken);

        var publicTicketId = OpaqueId.Format("ticket", ticket.Id);
        var actorId = OpaqueId.Format("user", access.UserId);
        var correlationId = CorrelationId(httpContext);

        await ledger.AppendAuditAsync(
            "helpdesk.ticket.created",
            "ticket",
            publicTicketId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new
            {
                ticket.TicketNumber,
                ticket.Priority,
                categoryId = categoryId.HasValue
                    ? OpaqueId.Format("cat", categoryId.Value)
                    : null,
                relatedDeviceId = relatedDeviceId.HasValue
                    ? OpaqueId.Format("dev", relatedDeviceId.Value)
                    : null
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
                categoryId = categoryId.HasValue
                    ? OpaqueId.Format("cat", categoryId.Value)
                    : null
            },
            correlationId,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(ticket.Version);
        return Results.Created(
            $"/api/v1/helpdesk/tickets/{publicTicketId}",
            new ResourceResponse<CreateTicketResponse>(
                new(
                    publicTicketId,
                    ticket.TicketNumber,
                    ticket.Subject,
                    "open",
                    ticket.Priority,
                    ticketSla.ResponseDueAt,
                    ticketSla.ResolutionDueAt,
                    Etag(ticket.Version))));
    }

    private static async Task<IResult> ReplyAsync(
        string ticketId,
        CreateReplyRequest request,
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        HelpdeskLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(ticketId, "ticket", out var id))
        {
            return NotFound("Ticket not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.reply",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        if (string.IsNullOrWhiteSpace(request.Body))
        {
            return Validation("body", "Reply text is required.");
        }

        var ticket = await db.Tickets.SingleOrDefaultAsync(
            x => x.Id == id,
            cancellationToken);
        if (ticket is null)
        {
            return NotFound("Ticket not found.");
        }
        if (!CanAccessTicket(access, ticket))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        var visibility = string.Equals(
            request.Visibility,
            "internal",
            StringComparison.OrdinalIgnoreCase)
            ? "internal"
            : "public";

        var now = DateTimeOffset.UtcNow;
        var reply = new TicketReply
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            AuthorUserId = access.UserId,
            Body = request.Body.Trim(),
            Visibility = visibility,
            CreatedAt = now
        };

        var sla = await db.TicketSla.SingleOrDefaultAsync(
            x => x.TicketId == ticket.Id,
            cancellationToken);

        var actorReply = access.UserId != ticket.RequesterUserId;
        TicketStatus? previousStatus = null;
        TicketStatus? nextStatus = null;
        if (actorReply && visibility == "public")
        {
            previousStatus = await db.Statuses.AsNoTracking()
                .SingleAsync(x => x.Id == ticket.StatusId, cancellationToken);
            if (previousStatus.Code == "open")
            {
                nextStatus = await db.Statuses.AsNoTracking()
                    .SingleAsync(x => x.Code == "in_progress", cancellationToken);
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.TicketReplies.Add(reply);
        ticket.Version++;
        ticket.UpdatedAt = now;

        if (sla is not null
            && !sla.ResponseMetAt.HasValue
            && actorReply)
        {
            sla.ResponseMetAt = now;
            sla.UpdatedAt = now;
        }

        if (nextStatus is not null && previousStatus is not null)
        {
            ticket.StatusId = nextStatus.Id;
            db.TicketStatusHistory.Add(new TicketStatusHistory
            {
                Id = Guid.NewGuid(),
                TicketId = ticket.Id,
                FromStatusId = previousStatus.Id,
                ToStatusId = nextStatus.Id,
                ChangedByUserId = access.UserId,
                Note = "First support response",
                ChangedAt = now
            });
        }

        await db.SaveChangesAsync(cancellationToken);

        var actorId = OpaqueId.Format("user", access.UserId);
        var correlationId = CorrelationId(httpContext);
        await ledger.AppendAuditAsync(
            "helpdesk.ticket.replied",
            "ticket",
            ticketId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new
            {
                replyId = OpaqueId.Format("reply", reply.Id),
                visibility
            },
            cancellationToken);

        if (nextStatus is not null && previousStatus is not null)
        {
            await ledger.AppendAuditAsync(
                "helpdesk.ticket.status_changed",
                "ticket",
                ticketId,
                actorId,
                correlationId,
                httpContext.TraceIdentifier,
                new
                {
                    fromStatus = previousStatus.Code,
                    toStatus = nextStatus.Code
                },
                cancellationToken);
            await ledger.AppendOutboxAsync(
                "ticket.status.changed",
                "ticket",
                ticketId,
                new
                {
                    ticketId,
                    fromStatus = previousStatus.Code,
                    toStatus = nextStatus.Code,
                    changedByUserId = actorId
                },
                correlationId,
                null,
                httpContext.TraceIdentifier,
                cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(ticket.Version);
        return Results.Ok(new ResourceResponse<TicketReplyMutationResponse>(
            new(
                OpaqueId.Format("reply", reply.Id),
                visibility,
                reply.CreatedAt,
                Etag(ticket.Version))));
    }

    private static async Task<IResult> ReassignAsync(
        string ticketId,
        ReassignTicketRequest request,
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        HelpdeskLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(ticketId, "ticket", out var id))
        {
            return NotFound("Ticket not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.assign",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var ticket = await db.Tickets.SingleOrDefaultAsync(
            x => x.Id == id,
            cancellationToken);
        if (ticket is null)
        {
            return NotFound("Ticket not found.");
        }
        if (!CanAccessTicket(access, ticket))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        var staleResult = ValidateIfMatch(httpContext, ticket.Version);
        if (staleResult is not null)
        {
            return staleResult;
        }

        Guid? assigneeId = null;
        if (!string.IsNullOrWhiteSpace(request.AssigneeUserId))
        {
            if (!OpaqueId.TryParse(request.AssigneeUserId, "user", out var parsedAssigneeId))
            {
                return Validation("assigneeUserId", "Invalid assignee.");
            }

            var users = await directoryReader.ReadUsersAsync(
                new[] { parsedAssigneeId },
                cancellationToken);
            if (!users.TryGetValue(parsedAssigneeId, out var assignee)
                || !string.Equals(assignee.Status, "active", StringComparison.OrdinalIgnoreCase))
            {
                return Validation("assigneeUserId", "Assignee is not active.");
            }
            assigneeId = parsedAssigneeId;
        }

        var team = string.IsNullOrWhiteSpace(request.Team)
            ? ticket.AssigneeTeam
            : request.Team.Trim();
        if (!assigneeId.HasValue && string.IsNullOrWhiteSpace(team))
        {
            return Validation(
                "team",
                "Choose an assignee or support team.");
        }

        var previousAssigneeId = ticket.AssigneeUserId;
        var now = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        ticket.AssigneeUserId = assigneeId;
        ticket.AssigneeTeam = team;
        ticket.Version++;
        ticket.UpdatedAt = now;

        db.TicketAssignments.Add(new TicketAssignment
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            PreviousAssigneeUserId = previousAssigneeId,
            AssigneeUserId = assigneeId,
            Team = team,
            AssignedByUserId = access.UserId,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            AssignedAt = now
        });

        await db.SaveChangesAsync(cancellationToken);

        var actorId = OpaqueId.Format("user", access.UserId);
        var correlationId = CorrelationId(httpContext);
        await ledger.AppendAuditAsync(
            "helpdesk.ticket.assigned",
            "ticket",
            ticketId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new
            {
                assigneeUserId = assigneeId.HasValue
                    ? OpaqueId.Format("user", assigneeId.Value)
                    : null,
                team
            },
            cancellationToken);
        await ledger.AppendOutboxAsync(
            "ticket.assigned",
            "ticket",
            ticketId,
            new
            {
                ticketId,
                teamId = TeamId(team),
                assigneeUserId = assigneeId.HasValue
                    ? OpaqueId.Format("user", assigneeId.Value)
                    : null,
                assignedByUserId = actorId
            },
            correlationId,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(ticket.Version);
        return Results.Ok(new ResourceResponse<TicketAssignmentMutationResponse>(
            new(
                assigneeId.HasValue
                    ? OpaqueId.Format("user", assigneeId.Value)
                    : null,
                team,
                now,
                Etag(ticket.Version))));
    }

    private static async Task<IResult> ResolveAsync(
        string ticketId,
        ResolveTicketRequest request,
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        HelpdeskLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(ticketId, "ticket", out var id))
        {
            return NotFound("Ticket not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.resolve",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var ticket = await db.Tickets.SingleOrDefaultAsync(
            x => x.Id == id,
            cancellationToken);
        if (ticket is null)
        {
            return NotFound("Ticket not found.");
        }
        if (!CanAccessTicket(access, ticket))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        var staleResult = ValidateIfMatch(httpContext, ticket.Version);
        if (staleResult is not null)
        {
            return staleResult;
        }

        var resolvedStatus = await db.Statuses.AsNoTracking()
            .SingleAsync(x => x.Code == "resolved", cancellationToken);
        var currentStatus = await db.Statuses.AsNoTracking()
            .SingleAsync(x => x.Id == ticket.StatusId, cancellationToken);

        if (currentStatus.IsClosed)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Ticket is already closed");
        }

        var resolutionCode = string.IsNullOrWhiteSpace(request.ResolutionCode)
            ? "resolved"
            : request.ResolutionCode.Trim().ToLowerInvariant();

        var now = DateTimeOffset.UtcNow;
        var previousStatusId = ticket.StatusId;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        ticket.StatusId = resolvedStatus.Id;
        ticket.ResolutionCode = resolutionCode;
        ticket.ResolvedAt = now;
        ticket.Version++;
        ticket.UpdatedAt = now;

        db.TicketStatusHistory.Add(new TicketStatusHistory
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            FromStatusId = previousStatusId,
            ToStatusId = resolvedStatus.Id,
            ChangedByUserId = access.UserId,
            Note = string.IsNullOrWhiteSpace(request.Note)
                ? "Ticket resolved"
                : request.Note.Trim(),
            ChangedAt = now
        });

        var sla = await db.TicketSla.SingleOrDefaultAsync(
            x => x.TicketId == ticket.Id,
            cancellationToken);
        if (sla is not null)
        {
            sla.ResolvedAt = now;
            sla.State = now <= sla.ResolutionDueAt ? "met" : "breached";
            sla.UpdatedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);

        var actorId = OpaqueId.Format("user", access.UserId);
        var correlationId = CorrelationId(httpContext);

        await ledger.AppendAuditAsync(
            "helpdesk.ticket.status_changed",
            "ticket",
            ticketId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new
            {
                fromStatus = currentStatus.Code,
                toStatus = resolvedStatus.Code
            },
            cancellationToken);
        await ledger.AppendAuditAsync(
            "helpdesk.ticket.resolved",
            "ticket",
            ticketId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new { resolutionCode },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "ticket.status.changed",
            "ticket",
            ticketId,
            new
            {
                ticketId,
                fromStatus = currentStatus.Code,
                toStatus = resolvedStatus.Code,
                changedByUserId = actorId
            },
            correlationId,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);
        await ledger.AppendOutboxAsync(
            "ticket.resolved",
            "ticket",
            ticketId,
            new
            {
                ticketId,
                resolvedByUserId = actorId,
                resolvedAt = now,
                resolutionCode
            },
            correlationId,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(ticket.Version);
        return Results.Ok(new ResourceResponse<ResolveTicketResponse>(
            new(
                ticketId,
                "resolved",
                resolutionCode,
                now,
                Etag(ticket.Version))));
    }

    private static async Task<IResult> GetCategoriesAsync(
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var rows = await db.Categories.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);

        var children = rows
            .Where(x => x.ParentCategoryId.HasValue)
            .GroupBy(x => x.ParentCategoryId!.Value)
            .ToDictionary(x => x.Key, x => x.ToArray());

        var roots = rows
            .Where(x => !x.ParentCategoryId.HasValue)
            .Select(x => ToCategoryNode(x, children))
            .ToList();

        return Results.Ok(new { items = roots });
    }

    private static async Task<IResult> GetStatusesAsync(
        HttpContext httpContext,
        HelpdeskDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "helpdesk.ticket.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var statuses = await db.Statuses.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.SortOrder)
            .Select(x => new StatusResponse(
                OpaqueId.Format("hds", x.Id),
                x.Code,
                x.Name,
                x.IsClosed))
            .ToListAsync(cancellationToken);

        return Results.Ok(new { items = statuses });
    }

    private static async Task<IReadOnlyList<TicketSummaryResponse>> BuildTicketSummariesAsync(
        IQueryable<Ticket> query,
        HelpdeskDbContext db,
        IPlatformDirectoryReader directoryReader,
        CancellationToken cancellationToken)
    {
        var tickets = await query.ToListAsync(cancellationToken);
        if (tickets.Count == 0)
        {
            return Array.Empty<TicketSummaryResponse>();
        }

        var ticketIds = tickets.Select(x => x.Id).ToArray();
        var statusIds = tickets.Select(x => x.StatusId).Distinct().ToArray();
        var categoryIds = tickets
            .Where(x => x.CategoryId.HasValue)
            .Select(x => x.CategoryId!.Value)
            .Distinct()
            .ToArray();
        var userIds = tickets
            .SelectMany(x => new[] { x.RequesterUserId, x.AssigneeUserId ?? Guid.Empty })
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToArray();
        var orgIds = tickets
            .Where(x => x.RequesterOrganizationUnitId.HasValue)
            .Select(x => x.RequesterOrganizationUnitId!.Value)
            .Distinct()
            .ToArray();

        var statuses = await db.Statuses.AsNoTracking()
            .Where(x => statusIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        var categories = await db.Categories.AsNoTracking()
            .Where(x => categoryIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        var slas = await db.TicketSla.AsNoTracking()
            .Where(x => ticketIds.Contains(x.TicketId))
            .ToDictionaryAsync(x => x.TicketId, cancellationToken);
        var directory = await directoryReader.ReadAsync(
            userIds,
            orgIds,
            Array.Empty<Guid>(),
            cancellationToken);

        var now = DateTimeOffset.UtcNow;
        return tickets.Select(ticket =>
        {
            var status = statuses[ticket.StatusId];
            var sla = slas.GetValueOrDefault(ticket.Id);
            var elapsed = sla is null
                ? 0
                : CalculateElapsedPercent(
                    ticket.CreatedAt,
                    sla.ResolutionDueAt,
                    ticket.ResolvedAt ?? now);
            var slaState = sla is null
                ? null
                : sla.ResolvedAt.HasValue
                    ? sla.State
                    : sla.ResolutionDueAt <= now
                        ? "breached"
                        : elapsed >= 75
                            ? "at_risk"
                            : "active";

            return new TicketSummaryResponse(
                OpaqueId.Format("ticket", ticket.Id),
                ticket.TicketNumber,
                ticket.Subject,
                status.Code,
                status.Name,
                ticket.Priority,
                ticket.RequesterOrganizationUnitId is Guid orgId
                    ? directory.Organizations.GetValueOrDefault(orgId)
                    : null,
                directory.Users.GetValueOrDefault(ticket.RequesterUserId) ?? "Requester",
                ticket.AssigneeUserId is Guid assigneeId
                    ? directory.Users.GetValueOrDefault(assigneeId)
                    : null,
                ticket.AssigneeTeam,
                ticket.CategoryId is Guid categoryId
                    ? categories.GetValueOrDefault(categoryId)?.Name
                    : null,
                slaState,
                sla?.ResolutionDueAt,
                elapsed,
                ticket.CreatedAt,
                ticket.UpdatedAt);
        }).ToList();
    }

    private static IQueryable<Ticket> ApplyTicketScope(
        IQueryable<Ticket> query,
        EffectiveAccess access)
    {
        if (access.AllResources)
        {
            return query;
        }

        var organizations = access.OrganizationIds.ToArray();
        var currentUserId = access.UserId;

        return query.Where(x =>
            x.RequesterUserId == currentUserId
            || x.AssigneeUserId == currentUserId
            || (x.RequesterOrganizationUnitId.HasValue
                && organizations.Contains(x.RequesterOrganizationUnitId.Value)));
    }

    private static bool CanAccessTicket(
        EffectiveAccess access,
        Ticket ticket) =>
        access.AllResources
        || ticket.RequesterUserId == access.UserId
        || ticket.AssigneeUserId == access.UserId
        || (ticket.RequesterOrganizationUnitId is Guid organizationId
            && access.OrganizationIds.Contains(organizationId));

    private static bool CanAccessDevice(
        EffectiveAccess access,
        DeviceDirectoryEntry device) =>
        access.AllResources
        || device.OwnerUserId == access.UserId
        || (device.OrganizationUnitId is Guid organizationId
            && access.OrganizationIds.Contains(organizationId))
        || (device.LocationId is Guid locationId
            && access.LocationIds.Contains(locationId))
        || device.GroupIds.Any(access.DeviceGroupIds.Contains);

    private static IQueryable<Ticket> ApplyTicketSort(
        IQueryable<Ticket> query,
        string? sort,
        string? order)
    {
        var descending = !string.Equals(order, "asc", StringComparison.OrdinalIgnoreCase);
        return sort?.Trim().ToLowerInvariant() switch
        {
            "createdat" => descending
                ? query.OrderByDescending(x => x.CreatedAt)
                : query.OrderBy(x => x.CreatedAt),
            "priority" => descending
                ? query.OrderByDescending(x => x.Priority).ThenByDescending(x => x.UpdatedAt)
                : query.OrderBy(x => x.Priority).ThenByDescending(x => x.UpdatedAt),
            _ => descending
                ? query.OrderByDescending(x => x.UpdatedAt)
                : query.OrderBy(x => x.UpdatedAt)
        };
    }

    private static int PriorityRank(string priority) =>
        priority switch
        {
            "P1" => 1,
            "P2" => 2,
            "P3" => 3,
            "P4" => 4,
            _ => 9
        };

    private static string NormalizePriority(
        string? requestedPriority,
        string? impact,
        string? urgency)
    {
        var explicitPriority = requestedPriority?.Trim().ToUpperInvariant();
        if (explicitPriority is "P1" or "P2" or "P3" or "P4")
        {
            return explicitPriority;
        }

        var impactValue = NormalizeImpact(impact);
        var urgencyValue = NormalizeUrgency(urgency);

        if (urgencyValue == "Critical" || impactValue == "Organization")
        {
            return "P1";
        }

        if (urgencyValue == "High"
            || impactValue is "Department" or "Team")
        {
            return "P2";
        }

        return "P3";
    }

    private static string NormalizeImpact(string? value) =>
        value?.Trim().ToLowerInvariant() switch
        {
            "organization" => "Organization",
            "department" => "Department",
            "team" => "Team",
            _ => "Individual"
        };

    private static string NormalizeUrgency(string? value) =>
        value?.Trim().ToLowerInvariant() switch
        {
            "critical" => "Critical",
            "high" => "High",
            "low" => "Low",
            _ => "Normal"
        };

    private static async Task<string> GenerateTicketNumberAsync(
        HelpdeskDbContext db,
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

    private static CategoryNodeResponse ToCategoryNode(
        Category category,
        IReadOnlyDictionary<Guid, Category[]> children) =>
        new(
            OpaqueId.Format("cat", category.Id),
            category.Code,
            category.Name,
            children.TryGetValue(category.Id, out var childRows)
                ? childRows.Select(x => ToCategoryNode(x, children)).ToList()
                : Array.Empty<CategoryNodeResponse>());

    private static int CalculateElapsedPercent(
        DateTimeOffset startedAt,
        DateTimeOffset dueAt,
        DateTimeOffset currentAt)
    {
        var total = Math.Max(1, (dueAt - startedAt).TotalSeconds);
        var elapsed = Math.Max(0, (currentAt - startedAt).TotalSeconds);
        return Math.Clamp((int)Math.Round(elapsed / total * 100d), 0, 100);
    }

    private static string EffectiveSlaState(
        TicketSla sla,
        DateTimeOffset now)
    {
        if (sla.ResolvedAt.HasValue)
        {
            return sla.State;
        }

        if (sla.ResolutionDueAt <= now)
        {
            return "breached";
        }

        var total = Math.Max(1, (sla.ResolutionDueAt - (sla.ResponseDueAt - TimeSpan.FromHours(1))).TotalSeconds);
        var remaining = (sla.ResolutionDueAt - now).TotalSeconds;
        return remaining / total <= 0.25 ? "at_risk" : sla.State;
    }

    private static string TeamId(string? team)
    {
        if (string.IsNullOrWhiteSpace(team))
        {
            return "team_unassigned";
        }

        var slug = new string(team.Trim().ToLowerInvariant()
            .Select(x => char.IsLetterOrDigit(x) ? x : '-')
            .ToArray());
        while (slug.Contains("--", StringComparison.Ordinal))
        {
            slug = slug.Replace("--", "-", StringComparison.Ordinal);
        }
        return "team_" + slug.Trim('-');
    }

    private static IResult? ValidateIfMatch(
        HttpContext httpContext,
        long currentVersion)
    {
        var raw = httpContext.Request.Headers.IfMatch.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (!TryReadVersion(raw, out var expectedVersion)
            || expectedVersion != currentVersion)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Ticket changed",
                detail: "Refresh the ticket and retry the action.");
        }

        return null;
    }

    private static bool TryReadVersion(
        string raw,
        out long version)
    {
        version = 0;
        var value = raw.Trim();
        if (value.StartsWith("W/\"", StringComparison.Ordinal)
            && value.EndsWith('"'))
        {
            value = value[3..^1];
        }
        else if (value.StartsWith('"')
            && value.EndsWith('"'))
        {
            value = value[1..^1];
        }

        return long.TryParse(value, out version);
    }

    private static string Etag(long version) => $"W/\"{version}\"";

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound(string detail) => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Resource not found",
        detail: detail);

    private static IResult Validation(
        string field,
        string detail) => Results.ValidationProblem(
        new Dictionary<string, string[]>
        {
            [field] = new[] { detail }
        },
        title: "Validation failed");

    public sealed record CreateTicketRequest(
        string Subject,
        string Description,
        string? CategoryId,
        string? Priority,
        string? Impact,
        string? Urgency,
        string? RelatedDeviceId);

    public sealed record CreateReplyRequest(
        string Body,
        string? Visibility);

    public sealed record ReassignTicketRequest(
        string? AssigneeUserId,
        string? Team,
        string? Note);

    public sealed record ResolveTicketRequest(
        string? ResolutionCode,
        string? Note);

    private sealed record ReferenceResponse(
        string Id,
        string Name);

    private sealed record UserReferenceResponse(
        string Id,
        string Name);

    private sealed record CategoryReferenceResponse(
        string Id,
        string Code,
        string Name);

    private sealed record DeviceReferenceResponse(
        string Id,
        string Name,
        string Status,
        string? OperatingSystem);

    private sealed record TicketMessageResponse(
        string Id,
        string AuthorUserId,
        string AuthorName,
        string Body,
        string Visibility,
        bool IsRequester,
        DateTimeOffset CreatedAt);

    private sealed record TicketActivityResponse(
        string Id,
        string Type,
        string Title,
        string? Detail,
        DateTimeOffset OccurredAt);

    private sealed record TicketSlaResponse(
        string PolicyId,
        string PolicyName,
        int ResponseMinutes,
        int ResolutionMinutes,
        DateTimeOffset ResponseDueAt,
        DateTimeOffset ResolutionDueAt,
        DateTimeOffset? ResponseMetAt,
        string State,
        int ElapsedPercent);

    private sealed record TicketSummaryResponse(
        string Id,
        string TicketNumber,
        string Subject,
        string Status,
        string StatusName,
        string Priority,
        string? Organization,
        string Requester,
        string? Assignee,
        string? Team,
        string? Category,
        string? SlaState,
        DateTimeOffset? ResolutionDueAt,
        int SlaElapsedPercent,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt);

    private sealed record TicketDetailResponse(
        string Id,
        string TicketNumber,
        string Subject,
        string Status,
        string StatusName,
        string Priority,
        string Impact,
        string Urgency,
        UserReferenceResponse Requester,
        ReferenceResponse? Organization,
        UserReferenceResponse? Assignee,
        string? Team,
        CategoryReferenceResponse? Category,
        DeviceReferenceResponse? RelatedDevice,
        string? RelatedAssetId,
        IReadOnlyList<TicketMessageResponse> Messages,
        IReadOnlyList<TicketActivityResponse> Activities,
        TicketSlaResponse? Sla,
        IReadOnlyList<UserReferenceResponse> AssigneeOptions,
        DateTimeOffset? ResolvedAt,
        string? ResolutionCode,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        string ETag);

    private sealed record HelpdeskOverviewResponse(
        int OpenTickets,
        int AssignedToMe,
        int Unassigned,
        int DueToday,
        int SlaAtRisk,
        int SlaBreached,
        IReadOnlyList<TicketSummaryResponse> PriorityTickets,
        IReadOnlyList<TicketSummaryResponse> MyTickets);

    private sealed record CreateTicketResponse(
        string Id,
        string TicketNumber,
        string Subject,
        string Status,
        string Priority,
        DateTimeOffset ResponseDueAt,
        DateTimeOffset ResolutionDueAt,
        string ETag);

    private sealed record TicketReplyMutationResponse(
        string ReplyId,
        string Visibility,
        DateTimeOffset CreatedAt,
        string ETag);

    private sealed record TicketAssignmentMutationResponse(
        string? AssigneeUserId,
        string? Team,
        DateTimeOffset AssignedAt,
        string ETag);

    private sealed record ResolveTicketResponse(
        string Id,
        string Status,
        string ResolutionCode,
        DateTimeOffset ResolvedAt,
        string ETag);

    private sealed record CategoryNodeResponse(
        string Id,
        string Code,
        string Name,
        IReadOnlyList<CategoryNodeResponse> Children);

    private sealed record StatusResponse(
        string Id,
        string Code,
        string Name,
        bool IsClosed);
}
