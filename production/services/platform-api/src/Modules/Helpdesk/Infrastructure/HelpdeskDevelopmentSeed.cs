using INNO.One.Modules.Helpdesk.Domain;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Infrastructure;

public static class HelpdeskDevelopmentSeed
{
    public static readonly Guid AdminUserId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    public static readonly Guid HrViewerUserId = Guid.Parse("10000000-0000-0000-0000-000000000002");
    public static readonly Guid SupportAgentUserId = Guid.Parse("10000000-0000-0000-0000-000000000003");
    public static readonly Guid SomchaiUserId = Guid.Parse("10000000-0000-0000-0000-000000000004");

    public static readonly Guid DigitalTechnologyId = Guid.Parse("20000000-0000-0000-0000-000000000002");
    public static readonly Guid HumanResourcesId = Guid.Parse("20000000-0000-0000-0000-000000000003");
    public static readonly Guid FinanceId = Guid.Parse("20000000-0000-0000-0000-000000000004");

    public static readonly Guid StatusOpenId = Guid.Parse("90000000-0000-0000-0000-000000000001");
    public static readonly Guid StatusInProgressId = Guid.Parse("90000000-0000-0000-0000-000000000002");
    public static readonly Guid StatusWaitingId = Guid.Parse("90000000-0000-0000-0000-000000000003");
    public static readonly Guid StatusResolvedId = Guid.Parse("90000000-0000-0000-0000-000000000004");

    public static readonly Guid NetworkCategoryId = Guid.Parse("91000000-0000-0000-0000-000000000001");
    public static readonly Guid VpnCategoryId = Guid.Parse("91000000-0000-0000-0000-000000000002");
    public static readonly Guid SoftwareCategoryId = Guid.Parse("91000000-0000-0000-0000-000000000003");
    public static readonly Guid AccessCategoryId = Guid.Parse("91000000-0000-0000-0000-000000000004");

    public static readonly Guid DefaultBusinessCalendarId = Guid.Parse("92000000-0000-0000-0000-000000000001");
    public static readonly Guid NetworkAutomationRuleId = Guid.Parse("95000000-0000-0000-0000-000000000001");
    public static readonly Guid CriticalAutomationRuleId = Guid.Parse("95000000-0000-0000-0000-000000000002");
    public static readonly Guid AfterHoursAutomationRuleId = Guid.Parse("95000000-0000-0000-0000-000000000003");

    public static async Task SeedAsync(
        HelpdeskDbContext db,
        CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        if (!await db.Statuses.AnyAsync(cancellationToken))
        {
            db.Statuses.AddRange(
                Status(StatusOpenId, "open", "Open", false, 10, now),
                Status(StatusInProgressId, "in_progress", "In Progress", false, 20, now),
                Status(StatusWaitingId, "waiting", "Waiting", false, 30, now),
                Status(StatusResolvedId, "resolved", "Resolved", true, 90, now));
        }

        if (!await db.Categories.AnyAsync(cancellationToken))
        {
            db.Categories.AddRange(
                Category(NetworkCategoryId, "network", "Network", null, 10, now),
                Category(VpnCategoryId, "network-vpn", "VPN", NetworkCategoryId, 20, now),
                Category(SoftwareCategoryId, "software", "Software", null, 30, now),
                Category(AccessCategoryId, "access", "Access & Identity", null, 40, now));
        }

        if (!await db.BusinessCalendars.AnyAsync(cancellationToken))
        {
            db.BusinessCalendars.Add(new BusinessCalendar
            {
                Id = DefaultBusinessCalendarId,
                Code = "office-hours-th",
                Name = "Office Hours TH",
                TimeZoneId = "Asia/Bangkok",
                IsDefault = true,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            });

            for (var day = 1; day <= 5; day++)
            {
                db.BusinessCalendarEntries.Add(new BusinessCalendarEntry
                {
                    Id = Guid.NewGuid(),
                    CalendarId = DefaultBusinessCalendarId,
                    EntryType = "weekly",
                    DayOfWeek = day,
                    StartMinute = 8 * 60 + 30,
                    EndMinute = 17 * 60 + 30,
                    IsWorking = true,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }

            db.BusinessCalendarEntries.AddRange(
                new BusinessCalendarEntry
                {
                    Id = Guid.NewGuid(),
                    CalendarId = DefaultBusinessCalendarId,
                    EntryType = "holiday",
                    CalendarDate = new DateOnly(2026, 10, 13),
                    Name = "King Bhumibol Memorial Day",
                    IsWorking = false,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new BusinessCalendarEntry
                {
                    Id = Guid.NewGuid(),
                    CalendarId = DefaultBusinessCalendarId,
                    EntryType = "holiday",
                    CalendarDate = new DateOnly(2026, 10, 23),
                    Name = "Chulalongkorn Day",
                    IsWorking = false,
                    CreatedAt = now,
                    UpdatedAt = now
                });
        }

        if (!await db.SlaPolicies.AnyAsync(cancellationToken))
        {
            db.SlaPolicies.AddRange(
                Sla("P1", "Critical", 15, 120, now),
                Sla("P2", "High", 60, 240, now),
                Sla("P3", "Normal", 240, 480, now),
                Sla("P4", "Low", 480, 960, now));
        }

        await db.SaveChangesAsync(cancellationToken);

        var currentPolicies = await db.SlaPolicies.ToListAsync(cancellationToken);
        foreach (var policy in currentPolicies)
        {
            policy.BusinessCalendarId ??= DefaultBusinessCalendarId;
            policy.AppliesTo ??= "All " + policy.Priority + " tickets";
            policy.PauseOnRequesterWait = true;
            policy.NotifyRequesterOnStatusChange = true;
            policy.ReassignOnBreach = true;
            if (string.IsNullOrWhiteSpace(policy.EscalationLevelsJson)
                || policy.EscalationLevelsJson == "[]")
            {
                policy.EscalationLevelsJson = DefaultEscalationJson();
            }
        }

        // Step 45F stops creating the legacy simple automation rules.
        // Existing installations migrate those rows into the shared Helpdesk-owned
        // workflow definition store. New installations author automation only through
        // /helpdesk/automation and the shared Automation Core.

        await db.SaveChangesAsync(cancellationToken);

        if (await db.Tickets.AnyAsync(cancellationToken))
        {
            return;
        }

        var policies = await db.SlaPolicies.ToDictionaryAsync(x => x.Priority, cancellationToken);

        var vpnCreated = now.AddHours(-2).AddMinutes(-42);
        var financeCreated = now.AddMinutes(-48);
        var softwareCreated = now.AddHours(-5);
        var resolvedCreated = now.AddDays(-1).AddHours(-3);

        var vpn = Ticket(
            Guid.Parse("93000000-0000-0000-0000-000000000001"),
            "HD-2026-001048",
            "Cannot connect VPN",
            "VPN times out after a Windows update. FortiClient has already been restarted.",
            SomchaiUserId,
            HumanResourcesId,
            SupportAgentUserId,
            "Network Support",
            VpnCategoryId,
            StatusInProgressId,
            "P2",
            "Individual",
            "High",
            Guid.Parse("80000000-0000-0000-0000-000000000001"),
            vpnCreated,
            now.AddMinutes(-8));

        var finance = Ticket(
            Guid.Parse("93000000-0000-0000-0000-000000000002"),
            "HD-2026-001049",
            "Payroll portal access denied",
            "Finance employee receives access denied after organization sign-in.",
            AdminUserId,
            FinanceId,
            null,
            "Support L1",
            AccessCategoryId,
            StatusOpenId,
            "P1",
            "Department",
            "Critical",
            null,
            financeCreated,
            financeCreated);

        var software = Ticket(
            Guid.Parse("93000000-0000-0000-0000-000000000003"),
            "HD-2026-001050",
            "Spreadsheet application crashes",
            "Application closes when opening the monthly workbook.",
            AdminUserId,
            DigitalTechnologyId,
            AdminUserId,
            "Application Team",
            SoftwareCategoryId,
            StatusInProgressId,
            "P3",
            "Individual",
            "Normal",
            Guid.Parse("80000000-0000-0000-0000-000000000002"),
            softwareCreated,
            now.AddHours(-1));

        var resolved = Ticket(
            Guid.Parse("93000000-0000-0000-0000-000000000004"),
            "HD-2026-001047",
            "Wi-Fi profile reset",
            "Corporate Wi-Fi profile required a refresh.",
            SomchaiUserId,
            HumanResourcesId,
            SupportAgentUserId,
            "Support L1",
            NetworkCategoryId,
            StatusResolvedId,
            "P3",
            "Individual",
            "Normal",
            Guid.Parse("80000000-0000-0000-0000-000000000001"),
            resolvedCreated,
            now.AddHours(-9));
        resolved.ResolutionCode = "fixed";
        resolved.ResolvedAt = now.AddHours(-9);

        db.Tickets.AddRange(vpn, finance, software, resolved);

        db.TicketReplies.AddRange(
            new TicketReply
            {
                Id = Guid.Parse("94000000-0000-0000-0000-000000000001"),
                TicketId = vpn.Id,
                AuthorUserId = SomchaiUserId,
                Body = "VPN ขึ้น timeout ทุกครั้งหลังจากอัปเดต Windows และลอง restart FortiClient แล้วแต่ยังเชื่อมต่อไม่ได้",
                Visibility = "public",
                CreatedAt = vpnCreated
            },
            new TicketReply
            {
                Id = Guid.Parse("94000000-0000-0000-0000-000000000002"),
                TicketId = vpn.Id,
                AuthorUserId = SupportAgentUserId,
                Body = "กำลังตรวจสอบ FortiClient version และ network profile ของเครื่อง พร้อมเทียบ policy ล่าสุด",
                Visibility = "public",
                CreatedAt = vpnCreated.AddMinutes(24)
            });

        db.TicketAssignments.AddRange(
            new TicketAssignment
            {
                Id = Guid.NewGuid(),
                TicketId = vpn.Id,
                AssigneeUserId = SupportAgentUserId,
                Team = "Network Support",
                AssignedByUserId = AdminUserId,
                Note = "Auto-routed by category",
                AssignedAt = vpnCreated.AddMinutes(1)
            },
            new TicketAssignment
            {
                Id = Guid.NewGuid(),
                TicketId = software.Id,
                AssigneeUserId = AdminUserId,
                Team = "Application Team",
                AssignedByUserId = AdminUserId,
                AssignedAt = softwareCreated.AddMinutes(3)
            });

        foreach (var ticket in new[] { vpn, finance, software, resolved })
        {
            db.TicketStatusHistory.Add(new TicketStatusHistory
            {
                Id = Guid.NewGuid(),
                TicketId = ticket.Id,
                FromStatusId = null,
                ToStatusId = ticket.Id == resolved.Id ? StatusOpenId : ticket.StatusId,
                ChangedByUserId = ticket.RequesterUserId,
                Note = "Ticket created",
                ChangedAt = ticket.CreatedAt
            });

            var policy = policies[ticket.Priority];
            var ticketSla = new TicketSla
            {
                Id = Guid.NewGuid(),
                TicketId = ticket.Id,
                PolicyId = policy.Id,
                ResponseDueAt = ticket.CreatedAt.AddMinutes(policy.ResponseMinutes),
                ResolutionDueAt = ticket.CreatedAt.AddMinutes(policy.ResolutionMinutes),
                ResponseMetAt = ticket.Id == vpn.Id
                    ? vpnCreated.AddMinutes(24)
                    : ticket.Id == software.Id
                        ? softwareCreated.AddMinutes(35)
                        : ticket.Id == resolved.Id
                            ? resolvedCreated.AddMinutes(40)
                            : null,
                ResolvedAt = ticket.ResolvedAt,
                State = ticket.ResolvedAt.HasValue
                    ? "met"
                    : ticket.CreatedAt.AddMinutes(policy.ResolutionMinutes) <= now
                        ? "breached"
                        : ticket.CreatedAt.AddMinutes(policy.ResolutionMinutes) <= now.AddMinutes(60)
                            ? "at_risk"
                            : "active",
                UpdatedAt = now
            };
            db.TicketSla.Add(ticketSla);
        }

        db.TicketStatusHistory.Add(new TicketStatusHistory
        {
            Id = Guid.NewGuid(),
            TicketId = resolved.Id,
            FromStatusId = StatusOpenId,
            ToStatusId = StatusResolvedId,
            ChangedByUserId = SupportAgentUserId,
            Note = "Wi-Fi profile refreshed",
            ChangedAt = resolved.ResolvedAt!.Value
        });

        await db.SaveChangesAsync(cancellationToken);
    }

    private static TicketStatus Status(
        Guid id, string code, string name, bool closed, int sortOrder, DateTimeOffset now) =>
        new()
        {
            Id = id,
            Code = code,
            Name = name,
            IsClosed = closed,
            SortOrder = sortOrder,
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        };

    private static Category Category(
        Guid id, string code, string name, Guid? parentId, int sortOrder, DateTimeOffset now) =>
        new()
        {
            Id = id,
            Code = code,
            Name = name,
            ParentCategoryId = parentId,
            Status = "active",
            SortOrder = sortOrder,
            CreatedAt = now,
            UpdatedAt = now
        };

    private static SlaPolicy Sla(
        string priority, string label, int responseMinutes, int resolutionMinutes, DateTimeOffset now) =>
        new()
        {
            Id = Guid.NewGuid(),
            Code = "sla-" + priority.ToLowerInvariant(),
            Name = priority + " · " + label,
            Priority = priority,
            ResponseMinutes = responseMinutes,
            ResolutionMinutes = resolutionMinutes,
            BusinessCalendarId = DefaultBusinessCalendarId,
            AppliesTo = "All " + priority + " tickets",
            PauseOnRequesterWait = true,
            NotifyRequesterOnStatusChange = true,
            ReassignOnBreach = true,
            EscalationLevelsJson = DefaultEscalationJson(),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

    private static string DefaultEscalationJson() =>
        """[{"level":1,"percent":75,"targetType":"team","targetId":"team_lead","reassignTeam":"Network Support"},{"level":2,"percent":90,"targetType":"role","targetId":"service_manager","reassignTeam":"Service Management"},{"level":3,"percent":100,"targetType":"role","targetId":"platform_admin","reassignTeam":"Critical Support"}]""";

    private static Ticket Ticket(
        Guid id,
        string number,
        string subject,
        string description,
        Guid requesterUserId,
        Guid requesterOrgId,
        Guid? assigneeUserId,
        string? team,
        Guid categoryId,
        Guid statusId,
        string priority,
        string impact,
        string urgency,
        Guid? relatedDeviceId,
        DateTimeOffset createdAt,
        DateTimeOffset updatedAt) =>
        new()
        {
            Id = id,
            TicketNumber = number,
            Subject = subject,
            Description = description,
            RequesterUserId = requesterUserId,
            RequesterOrganizationUnitId = requesterOrgId,
            AssigneeUserId = assigneeUserId,
            AssigneeTeam = team,
            CategoryId = categoryId,
            StatusId = statusId,
            Priority = priority,
            Impact = impact,
            Urgency = urgency,
            RelatedDeviceId = relatedDeviceId,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt
        };
}
