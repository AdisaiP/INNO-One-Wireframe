using INNO.One.Modules.Helpdesk.Domain;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Infrastructure;

public sealed class BusinessTimeCalculator(HelpdeskDbContext db)
{
    public async Task<Guid?> GetDefaultCalendarIdAsync(
        CancellationToken cancellationToken = default) =>
        await db.BusinessCalendars.AsNoTracking()
            .Where(x => x.IsDefault && x.IsActive)
            .OrderBy(x => x.Code)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<DateTimeOffset> AddBusinessMinutesAsync(
        DateTimeOffset start,
        int minutes,
        Guid? calendarId,
        CancellationToken cancellationToken = default)
    {
        if (minutes <= 0 || !calendarId.HasValue)
        {
            return start.AddMinutes(Math.Max(0, minutes)).ToUniversalTime();
        }

        var definition = await LoadAsync(calendarId.Value, cancellationToken);
        if (definition is null)
        {
            return start.AddMinutes(minutes).ToUniversalTime();
        }

        var localCursor = TimeZoneInfo.ConvertTime(start, definition.TimeZone);
        var remaining = minutes;

        for (var dayOffset = 0; dayOffset < 370; dayOffset++)
        {
            var date = DateOnly.FromDateTime(localCursor.DateTime).AddDays(dayOffset == 0 ? 0 : 1);
            if (dayOffset > 0)
            {
                localCursor = AtLocal(date, 0, definition.TimeZone);
            }

            foreach (var window in WindowsForDate(date, definition))
            {
                var effectiveStart = localCursor > window.Start
                    ? localCursor
                    : window.Start;

                if (effectiveStart >= window.End)
                {
                    continue;
                }

                var available = (int)Math.Floor((window.End - effectiveStart).TotalMinutes);
                if (available <= 0)
                {
                    continue;
                }

                if (remaining <= available)
                {
                    return effectiveStart.AddMinutes(remaining).ToUniversalTime();
                }

                remaining -= available;
            }
        }

        throw new InvalidOperationException(
            "Business calendar could not resolve the requested SLA target within one year.");
    }

    public async Task<int> CountBusinessMinutesAsync(
        DateTimeOffset start,
        DateTimeOffset end,
        Guid? calendarId,
        CancellationToken cancellationToken = default)
    {
        if (end <= start)
        {
            return 0;
        }

        if (!calendarId.HasValue)
        {
            return Math.Max(0, (int)Math.Floor((end - start).TotalMinutes));
        }

        var definition = await LoadAsync(calendarId.Value, cancellationToken);
        if (definition is null)
        {
            return Math.Max(0, (int)Math.Floor((end - start).TotalMinutes));
        }

        var localStart = TimeZoneInfo.ConvertTime(start, definition.TimeZone);
        var localEnd = TimeZoneInfo.ConvertTime(end, definition.TimeZone);
        var cursorDate = DateOnly.FromDateTime(localStart.DateTime);
        var endDate = DateOnly.FromDateTime(localEnd.DateTime);
        var total = 0;

        while (cursorDate <= endDate)
        {
            foreach (var window in WindowsForDate(cursorDate, definition))
            {
                var from = localStart > window.Start ? localStart : window.Start;
                var to = localEnd < window.End ? localEnd : window.End;
                if (to > from)
                {
                    total += Math.Max(0, (int)Math.Floor((to - from).TotalMinutes));
                }
            }

            cursorDate = cursorDate.AddDays(1);
        }

        return total;
    }

    public async Task<bool> IsWorkingTimeAsync(
        DateTimeOffset instant,
        Guid? calendarId,
        CancellationToken cancellationToken = default)
    {
        if (!calendarId.HasValue)
        {
            return true;
        }

        var definition = await LoadAsync(calendarId.Value, cancellationToken);
        if (definition is null)
        {
            return true;
        }

        var local = TimeZoneInfo.ConvertTime(instant, definition.TimeZone);
        var date = DateOnly.FromDateTime(local.DateTime);
        return WindowsForDate(date, definition)
            .Any(x => local >= x.Start && local < x.End);
    }

    private async Task<CalendarDefinition?> LoadAsync(
        Guid calendarId,
        CancellationToken cancellationToken)
    {
        var calendar = await db.BusinessCalendars.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == calendarId && x.IsActive,
                cancellationToken);
        if (calendar is null)
        {
            return null;
        }

        var entries = await db.BusinessCalendarEntries.AsNoTracking()
            .Where(x => x.CalendarId == calendarId)
            .ToListAsync(cancellationToken);

        TimeZoneInfo timeZone;
        try
        {
            timeZone = TimeZoneInfo.FindSystemTimeZoneById(calendar.TimeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            timeZone = TimeZoneInfo.Utc;
        }

        return new CalendarDefinition(calendar, entries, timeZone);
    }

    private static IReadOnlyList<BusinessWindow> WindowsForDate(
        DateOnly date,
        CalendarDefinition definition)
    {
        var datedEntries = definition.Entries
            .Where(x => x.CalendarDate == date)
            .ToArray();

        if (datedEntries.Any(x => !x.IsWorking))
        {
            return Array.Empty<BusinessWindow>();
        }

        var source = datedEntries.Any(x => x.IsWorking)
            ? datedEntries.Where(x => x.IsWorking)
            : definition.Entries.Where(x =>
                x.EntryType == "weekly"
                && x.IsWorking
                && x.DayOfWeek == (int)date.DayOfWeek);

        return source
            .Where(x => x.StartMinute.HasValue && x.EndMinute.HasValue)
            .OrderBy(x => x.StartMinute)
            .Select(x => new BusinessWindow(
                AtLocal(date, x.StartMinute!.Value, definition.TimeZone),
                AtLocal(date, x.EndMinute!.Value, definition.TimeZone)))
            .Where(x => x.End > x.Start)
            .ToArray();
    }

    private static DateTimeOffset AtLocal(
        DateOnly date,
        int minuteOfDay,
        TimeZoneInfo timeZone)
    {
        if (minuteOfDay >= 1440)
        {
            date = date.AddDays(minuteOfDay / 1440);
            minuteOfDay %= 1440;
        }

        var time = TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(minuteOfDay));
        var local = DateTime.SpecifyKind(
            date.ToDateTime(time),
            DateTimeKind.Unspecified);
        return new DateTimeOffset(local, timeZone.GetUtcOffset(local));
    }

    private sealed record CalendarDefinition(
        BusinessCalendar Calendar,
        IReadOnlyList<BusinessCalendarEntry> Entries,
        TimeZoneInfo TimeZone);

    private sealed record BusinessWindow(
        DateTimeOffset Start,
        DateTimeOffset End);
}
