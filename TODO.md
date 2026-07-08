# TODO

- Grafana is now exposed publicly via Traefik at `grafana.<tls.host>` (see
  `infra/helm/templates/traefik-configmap.yaml` / `ingress.yaml`), but it has
  no auth middleware in front of it, unlike the app's `/api/*` routes
  (`firebase-auth`). Decide whether it needs auth or an IP allowlist before
  relying on it publicly.
- Adopt Flyway for DB schema management on the Spring services. Today both
  `invoice-service` and `suggestions-service` run `spring.jpa.hibernate.ddl-auto=update`
  (schema is implicit in the JPA entities, no documented/versioned schema), and
  `InvoiceStatusBackfill.java` is a data migration disguised as a startup
  `CommandLineRunner`. Plan: baseline the current schema as `V1__baseline.sql` (export it
  from Hibernate's own DDL rather than hand-writing it), flip to `ddl-auto=validate`,
  convert the backfill into `V2__backfill_invoice_status.sql` (then delete the runner +
  `markNullStatusAccepted`), disable Flyway in the H2 test profile
  (`spring.flyway.enabled=false`), keep `CREATE EXTENSION vector` / `CREATE SCHEMA` in
  `infra/postgres/init.sql`, and leave llm-chat's library-managed pgvector table
  (`langchain_postgres`) out of scope. Verify `ddl-auto=validate` passes from a clean
  volume before merging.
- Presentation
- Github Actions workflows to execute the tests for each micorservice.