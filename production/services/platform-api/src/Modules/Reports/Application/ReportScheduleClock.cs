namespace INNO.One.Modules.Reports.Application;

public static class ReportScheduleClock
{
    public static DateTimeOffset NextOccurrence(
        string cadence,
        string timeZoneId,
        int hour,
        int minute,
        int? dayOfWeek,
        int? dayOfMonth,
        DateTimeOffset after)
    {
        var zone = ResolveTimeZone(timeZoneId);
        var localAfter = TimeZoneInfo.ConvertTime(after, zone);
        var localDate = localAfter.Date;

        DateTime candidate = cadence.Trim().ToLowerInvariant() switch
        {
            "daily" => NextDaily(localDate, localAfter.DateTime, hour, minute),
            "weekly" => NextWeekly(
                localDate,
                localAfter.DateTime,
                hour,
                minute,
                dayOfWeek ?? (int)DayOfWeek.Monday),
            "monthly" => NextMonthly(
                localDate,
                localAfter.DateTime,
                hour,
                minute,
                dayOfMonth ?? 1),
            _ => NextDaily(localDate, localAfter.DateTime, hour, minute)
        };

        candidate = DateTime.SpecifyKind(candidate, DateTimeKind.Unspecified);
        return new DateTimeOffset(
            TimeZoneInfo.ConvertTimeToUtc(candidate, zone),
            TimeSpan.Zero);
    }

    private static DateTime NextDaily(
        DateTime date,
        DateTime localAfter,
        int hour,
        int minute)
    {
        var candidate = date.AddHours(hour).AddMinutes(minute);
        return candidate > localAfter ? candidate : candidate.AddDays(1);
    }

    private static DateTime NextWeekly(
        DateTime date,
        DateTime localAfter,
        int hour,
        int minute,
        int dayOfWeek)
    {
        dayOfWeek = Math.Clamp(dayOfWeek, 0, 6);
        var delta = (dayOfWeek - (int)date.DayOfWeek + 7) % 7;
        var candidate = date.AddDays(delta).AddHours(hour).AddMinutes(minute);
        if (candidate <= localAfter)
        {
            candidate = candidate.AddDays(7);
        }
        return candidate;
    }

    private static DateTime NextMonthly(
        DateTime date,
        DateTime localAfter,
        int hour,
        int minute,
        int dayOfMonth)
    {
        dayOfMonth = Math.Clamp(dayOfMonth, 1, 31);
        var candidate = AtDay(date.Year, date.Month, dayOfMonth, hour, minute);
        if (candidate <= localAfter)
        {
            var next = date.AddMonths(1);
            candidate = AtDay(next.Year, next.Month, dayOfMonth, hour, minute);
        }
        return candidate;
    }

    private static DateTime AtDay(
        int year,
        int month,
        int day,
        int hour,
        int minute)
    {
        var actualDay = Math.Min(day, DateTime.DaysInMonth(year, month));
        return new DateTime(year, month, actualDay, hour, minute, 0);
    }

    public static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch
        {
            return TimeZoneInfo.Utc;
        }
    }
}
