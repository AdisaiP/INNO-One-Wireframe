# Devices migrations

Owned only by the Devices module.

Generate from production/:

~~~bash
dotnet tool restore
dotnet ef migrations add <Name> \
  --project services/platform-api/src/Modules/Devices \
  --startup-project services/platform-api/src/INNO.One.PlatformApi \
  --context DevicesDbContext \
  --output-dir Persistence/Migrations
~~~

A module migration must not alter another module schema.
