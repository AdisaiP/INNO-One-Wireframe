# Platform migrations

Owned only by the Platform module.

Generate from production/:

~~~bash
dotnet tool restore
dotnet ef migrations add <Name> \
  --project services/platform-api/src/Modules/Platform \
  --startup-project services/platform-api/src/INNO.One.PlatformApi \
  --context PlatformDbContext \
  --output-dir Persistence/Migrations
~~~

A module migration must not alter another module schema.
