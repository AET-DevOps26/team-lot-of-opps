# Database Schema

Single Postgres instance (`taxforward` database, `pgvector/pgvector:pg16` image), split into
per-service logical schemas for isolation. Each Spring Boot service owns its schema and applies
its own Flyway migrations on startup; `infra/postgres/init.sql` only creates the extension and
the empty schemas ahead of time.

| Schema | Owning service | Migrations |
|---|---|---|
| `invoice` | invoice-service | `services/invoice-service/src/main/resources/db/migration/` |
| `suggestions` | suggestions-service | `services/suggestions-service/src/main/resources/db/migration/` |
| `llm_chat` | llm-chat | managed by `langchain-postgres` (pgvector store), not Flyway |

`export-service` is absent on purpose: it is stateless and derives every export from
`invoice-service` over HTTP, so it owns no schema and needs no migrations.

## `invoice` schema

### `documents`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | `BIGINT` (identity) | no | PK |
| filename | `VARCHAR(255)` | no | |
| content_type | `VARCHAR(255)` | no | |
| size_bytes | `BIGINT` | no | |
| uploaded_at | `TIMESTAMP` | no | set on insert |
| storage_path | `VARCHAR(255)` | yes | path in SeaweedFS (S3-compatible) |
| user_id | `VARCHAR(255)` | yes | |
| content_hash | `VARCHAR(64)` | yes | used for dedup lookups |

### `invoices`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | `BIGINT` (identity) | no | PK |
| item_name | `VARCHAR(255)` | no | |
| company | `VARCHAR(255)` | no | |
| price | `NUMERIC(10,2)` | no | |
| category | `VARCHAR(255)` | yes | enum name, see `InvoiceCategory`; `CHECK` constrained to the enum's values |
| status | `VARCHAR(255)` | yes | enum name (`PENDING`/`ACCEPTED`); `CHECK` constrained; nullable for legacy rows, backfilled to `ACCEPTED` on startup by `InvoiceStatusBackfill` |
| user_id | `VARCHAR(255)` | yes | |
| document_id | `BIGINT` | yes | FK → `documents.id` |
| invoice_date | `DATE` | yes | |
| created_at | `TIMESTAMP` | no | set on insert |

Index: `idx_invoices_document_id` on `invoices.document_id`.

## `suggestions` schema

### `suggestions`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | `BIGINT` (identity) | no | PK |
| user_id | `VARCHAR(255)` | no | |
| suggestion | `TEXT` | no | LLM-generated suggestion text |
| language | `VARCHAR(255)` | yes | e.g. `en`, `de`; nullable for rows predating this column |
| created_at | `TIMESTAMP` | no | set on insert |

## Migrations

Both services use Flyway (`org.flywaydb:flyway-core` + `flyway-database-postgresql`), with
`spring.jpa.hibernate.ddl-auto=validate` — Hibernate only verifies the schema matches the
entities at startup, it no longer mutates it. Schema changes must go through a new
`V<n>__description.sql` file in the service's `db/migration/` directory.

Flyway is disabled in tests (`spring.flyway.enabled=false` in `src/test/resources/application.properties`);
tests run against an in-memory H2 database created from the JPA entities via `ddl-auto=create-drop`.

`spring.flyway.baseline-on-migrate=true` is set in both services so environments that already had
tables from the old `ddl-auto=update` era (e.g. an existing local dev DB volume) get baselined at
V1 instead of Flyway refusing to touch a schema it doesn't recognize. Fresh/empty databases run V1
normally.
