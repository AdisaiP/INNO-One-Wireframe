namespace INNO.One.Modules.Platform.Domain;

public sealed class UserProfile
{
    public Guid Id { get; set; }
    public required string KeycloakSubject { get; set; }
    public required string EmployeeId { get; set; }
    public required string FullName { get; set; }
    public Guid? OrganizationUnitId { get; set; }
    public Guid? PositionId { get; set; }
    public Guid? LocationId { get; set; }
    public required string Email { get; set; }
    public string? Phone { get; set; }
    public string? Office { get; set; }
    public required string Status { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class OrganizationUnit
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public Guid? ParentUnitId { get; set; }
    public required string Status { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Location
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public Guid? ParentLocationId { get; set; }
    public required string Status { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Position
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string Status { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Role
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string Status { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Permission
{
    public required string PermissionId { get; set; }
    public required string Module { get; set; }
    public required string Name { get; set; }
}

public sealed class RolePermission
{
    public Guid RoleId { get; set; }
    public required string PermissionId { get; set; }
}

public sealed class AccessAssignment
{
    public Guid Id { get; set; }
    public required string SubjectType { get; set; }
    public Guid SubjectId { get; set; }
    public Guid RoleId { get; set; }
    public required string ScopeType { get; set; }
    public bool IncludeChildren { get; set; }
    public required string Status { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AccessAssignmentResource
{
    public Guid AssignmentId { get; set; }
    public required string ResourceType { get; set; }
    public Guid ResourceId { get; set; }
}

public sealed class AccessAssignmentAction
{
    public Guid AssignmentId { get; set; }
    public required string PermissionId { get; set; }
}

public sealed class AppModule
{
    public Guid Id { get; set; }
    public required string AppId { get; set; }
    public bool Installed { get; set; }
    public bool Enabled { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class PlatformNotification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string SourceModule { get; set; }
    public required string NotificationType { get; set; }
    public required string Title { get; set; }
    public required string Message { get; set; }
    public required string DestinationPath { get; set; }
    public bool IsImportant { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class PlatformActivityItem
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string SourceModule { get; set; }
    public required string ResourceType { get; set; }
    public required string ResourceId { get; set; }
    public required string Title { get; set; }
    public required string Activity { get; set; }
    public required string DestinationPath { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
}
