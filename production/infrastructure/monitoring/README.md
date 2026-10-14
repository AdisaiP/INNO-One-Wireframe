# Monitoring and observability baseline

INNO.One remains vendor-neutral and OpenTelemetry-compatible. The CORE baseline standardizes request context and service health without coupling the application to a specific monitoring vendor.

## Request context

Platform API requests use:

- `X-Correlation-Id` - business/request correlation identifier. A safe incoming value is preserved; otherwise the API generates one.
- `X-Trace-Id` - W3C activity trace identifier returned by the Platform API.
- `HttpContext.TraceIdentifier` is normalized to the active W3C trace ID so existing audit/event code records the same trace identifier.

Both IDs are added to the structured logging scope. Request completion logs include method, path, status, duration, and authenticated subject when available.

Do not log access tokens, passwords, secrets, or sensitive request bodies.

## Health endpoints

### `/health/live`

Process liveness only. A successful response means the Platform API process is running and can serve HTTP.

### `/health/ready`

Dependency-aware readiness. The endpoint uses the existing `IIntegrationHealthProvider` implementations.

Required dependencies:

- Core PostgreSQL database
- Keycloak

Optional dependencies:

- enabled optional integrations such as MeshCentral must be healthy
- disabled optional integrations do not block readiness

The endpoint returns:

- HTTP 200 with status `ready` when required and enabled dependencies are healthy
- HTTP 503 with status `degraded` when required or enabled dependencies are unavailable

The payload includes sanitized dependency status and check duration for operator diagnosis.

## Future monitoring integration

Metrics/exporter/vendor selection remains deferred. Future integrations should consume the standardized correlation/trace context and remain OpenTelemetry-compatible.
