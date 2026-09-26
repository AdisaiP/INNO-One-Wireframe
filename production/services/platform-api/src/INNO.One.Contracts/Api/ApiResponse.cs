namespace INNO.One.Contracts.Api;

public sealed record ResourceResponse<T>(T Data);

public sealed record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);
