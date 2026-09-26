# Helpdesk migrations

Owned only by the Helpdesk module.

Generate from production/:

~~~bash
dotnet tool restore
dotnet ef migrations add <Name> \
  --project services/platform-api/src/Modules/Helpdesk \
  --startup-project services/platform-api/src/INNO.One.PlatformApi \
  --context HelpdeskDbContext \
  --output-dir Persistence/Migrations
~~~

A module migration must not alter another module schema.
