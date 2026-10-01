namespace INNO.One.Modules.Devices.Domain;

public sealed record InventoryQueryDefinition(
    string FactType,
    string Field,
    string Operator,
    string Value,
    string ScopeType,
    Guid? ScopeId);

public sealed record InventoryQueryAccessScope(
    bool AllResources,
    Guid[] OrganizationIds,
    Guid[] LocationIds,
    Guid[] DeviceGroupIds);
