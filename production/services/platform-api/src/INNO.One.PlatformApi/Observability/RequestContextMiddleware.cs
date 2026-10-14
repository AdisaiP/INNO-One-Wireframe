using System.Diagnostics;

namespace INNO.One.PlatformApi.Observability;

public sealed class RequestContextMiddleware(
    RequestDelegate next,
    ILogger<RequestContextMiddleware> logger)
{
    public const string CorrelationHeader = "X-Correlation-Id";
    public const string TraceHeader = "X-Trace-Id";
    public const string CorrelationItem = "INNO.One.CorrelationId";

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = ResolveCorrelationId(context);
        var traceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
        var started = Stopwatch.GetTimestamp();

        context.TraceIdentifier = traceId;
        context.Request.Headers[CorrelationHeader] = correlationId;
        context.Items[CorrelationItem] = correlationId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[CorrelationHeader] = correlationId;
            context.Response.Headers[TraceHeader] = traceId;
            return Task.CompletedTask;
        });

        using var scope = logger.BeginScope(new Dictionary<string, object>
        {
            ["correlationId"] = correlationId,
            ["traceId"] = traceId,
            ["requestId"] = context.TraceIdentifier
        });

        Exception? failure = null;
        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            failure = exception;
            logger.LogError(
                exception,
                "HTTP request failed {Method} {Path}",
                context.Request.Method,
                context.Request.Path);
            throw;
        }
        finally
        {
            var elapsedMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            var statusCode = failure is null
                ? context.Response.StatusCode
                : StatusCodes.Status500InternalServerError;
            var subject = context.User.FindFirst("sub")?.Value ?? "anonymous";

            logger.LogInformation(
                "HTTP request completed {Method} {Path} {StatusCode} in {ElapsedMs:F1} ms for {AuthSubject}",
                context.Request.Method,
                context.Request.Path,
                statusCode,
                elapsedMs,
                subject);
        }
    }

    private static string ResolveCorrelationId(HttpContext context)
    {
        var incoming = context.Request.Headers[CorrelationHeader].FirstOrDefault()?.Trim();
        if (IsSafeCorrelationId(incoming))
        {
            return incoming!;
        }

        return Guid.NewGuid().ToString("N");
    }

    private static bool IsSafeCorrelationId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 128)
        {
            return false;
        }

        return value.All(character =>
            char.IsLetterOrDigit(character)
            || character is '-' or '_' or '.' or ':');
    }
}
