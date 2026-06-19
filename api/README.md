# `api/` — API contracts (single source of truth)

This directory is the planned home for the versioned OpenAPI specification(s) that
define the contracts between services (Spring Boot + FastAPI) and the web `client`.

Per the project's best-practices guide, the spec here is meant to be the **single
source of truth**: backend stubs, the Python/Java cross-service clients, and the
frontend TypeScript SDK should all be generated from it rather than hand-written.

## Status

Scaffold only. The repository currently exposes OpenAPI dynamically via
springdoc (Spring services) and FastAPI (Python services). Extracting a static
`openapi.yaml` here and wiring code generation + linting is a follow-up step and
is **not** yet implemented.

## Intended layout

```
api/
├── openapi.yaml     # versioned spec (v1, v2, …)
└── scripts/         # code-gen helpers (gen-all.sh, per-language config)
```
