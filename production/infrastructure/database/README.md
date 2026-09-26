# PostgreSQL local bootstrap

Step 13 freezes PostgreSQL with:
- inno_core
- inno_meeting
- keycloak

The bootstrap script creates databases and schemas only.
EF Core module migrations own application tables.
