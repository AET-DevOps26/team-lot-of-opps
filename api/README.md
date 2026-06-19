# `api/` — API contracts (single source of truth)

This directory holds the versioned OpenAPI specification that defines the
contracts between the backend services (Spring Boot + FastAPI) and the web
`client`.

Per the project's best-practices guide, [`openapi.yaml`](openapi.yaml) is the
**single source of truth**: the frontend TypeScript SDK and the cross-service
Python/Java clients are generated from it rather than hand-written.

## Layout

```
api/
├── openapi.yaml     # versioned spec (info.version: 1.0.0)
├── scripts/
│   └── gen-all.sh   # regenerate every client/stub from the spec
└── generated/       # codegen output (git-ignored)
```

## What the spec covers

- **Public API** (`Documents`, `Invoices`, `Suggestions`, `Chat`) — the surface
  the web client consumes through the **Traefik** gateway. Auth is a Firebase ID
  token (`Authorization: Bearer …`); the gateway's forward-auth middleware
  validates it and injects `X-User-Sub` downstream.
- **Internal API** (`Internal`) — service-to-service endpoints that are **not**
  exposed through the public gateway (e.g. `invoice-service` ↔ `suggestions-service`,
  `invoice-service` → `llm-chat` embeddings). Documented here so the spec stays a
  complete source of truth; each operation notes its hosting service.

## Linting

The spec is linted with [Redocly CLI](https://redocly.com/docs/cli/) against the
`recommended` ruleset (configured in [`../.redocly.yaml`](../.redocly.yaml)).
**Never merge a spec change without a passing lint.**

```bash
npx @redocly/cli lint api/openapi.yaml
```

This runs automatically on commit via the `openapi-lint` pre-commit hook (see
[`../.pre-commit-config.yaml`](../.pre-commit-config.yaml)). Install it once:

```bash
pip install pre-commit   # or: brew install pre-commit
pre-commit install
pre-commit run -a        # run against all files
```

## Code generation

[`scripts/gen-all.sh`](scripts/gen-all.sh) regenerates every artifact from the
spec. Each generator is optional and skipped (with a hint) if its CLI is missing.

```bash
./api/scripts/gen-all.sh          # everything available
./api/scripts/gen-all.sh ts       # only the TypeScript SDK
```

| Target   | Tool                                   | Output                              |
|----------|----------------------------------------|-------------------------------------|
| `ts`     | `openapi-typescript` (via `npx`)       | `client/src/api/schema.ts`          |
| `python` | `openapi-python-client`                | `api/generated/python-client/`      |
| `java`   | `@openapitools/openapi-generator-cli`  | `api/generated/java/`               |

Generated output is **git-ignored** (`api/generated/` and
`client/src/api/schema.ts`) and regenerated on demand — do not edit it by hand.

## Preview & mock

```bash
npx @redocly/cli preview-docs api/openapi.yaml   # live docs preview
npx @stoplight/prism-cli mock api/openapi.yaml   # mock server on :4010
```

## Conventions

- The spec is authoritative — change `openapi.yaml` first, then regenerate.
- Bump `info.version` (and introduce versioned paths) for breaking changes so
  existing clients are not broken during iteration.
