# Integration tests

Integration tests exercise production persistence and authorization behavior against real infrastructure dependencies.

## Platform integration tests

Project:

`INNO.One.Platform.IntegrationTests/`

The suite currently exercises the production `PlatformDbContext` and `AccessEvaluator` against PostgreSQL.

Required environment variable:

~~~text
INNO_TEST_DATABASE=Host=localhost;Port=5432;Database=inno_test;Username=postgres;Password=postgres
~~~

The target database is **disposable**. The fixture drops and recreates it to provide deterministic isolation. Never point `INNO_TEST_DATABASE` at a developer, UAT, or production database.

GitHub Actions provisions a dedicated PostgreSQL service automatically.

Run locally from `production/` when PostgreSQL is available:

~~~bash
dotnet test tests/integration/INNO.One.Platform.IntegrationTests/INNO.One.Platform.IntegrationTests.csproj
~~~
