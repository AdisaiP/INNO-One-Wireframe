# Platform API

ASP.NET Core / .NET 10 modular monolith.

Composition root: src/INNO.One.PlatformApi

Owned module projects:
- Platform
- Devices
- Assets
- Helpdesk
- Reports

Infrastructure owns integration/audit/readmodel persistence boundaries.
Keycloak and MeshCentral are adapter projects, not domain modules.
