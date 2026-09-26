export interface AccessContext {
  permissions: ReadonlySet<string>;
}

export function hasPermission(context: AccessContext, permission: string): boolean {
  return context.permissions.has('*') || context.permissions.has(permission);
}
