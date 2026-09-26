# Reports migrations

Owned only by the Reports module.

Generate from production/:

~~~bash
dotnet tool restore
dotnet ef migrations add <Name> \
  --project services/platform-api/src/Modules/Reports \
  --startup-project services/platform-api/src/INNO.One.PlatformApi \
  --context ReportsDbContext \
  --output-dir Persistence/Migrations
~~~

A module migration must not alter another module schema.
