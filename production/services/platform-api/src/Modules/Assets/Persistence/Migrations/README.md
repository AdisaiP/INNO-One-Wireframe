# Assets migrations

Owned only by the Assets module.

Generate from production/:

~~~bash
dotnet tool restore
dotnet ef migrations add <Name> \
  --project services/platform-api/src/Modules/Assets \
  --startup-project services/platform-api/src/INNO.One.PlatformApi \
  --context AssetsDbContext \
  --output-dir Persistence/Migrations
~~~

A module migration must not alter another module schema.
