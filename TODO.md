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
- Wire an Alertmanager receiver. Alertmanager is enabled (`infra/monitoring/values.yaml`)
  and the `taxforward` PrometheusRule now loads and fires, but there is no receiver/route, so
  alerts only surface in the Prometheus/Alertmanager UI and notify nowhere. Add a receiver
  under `kube-prometheus-stack.alertmanager.config` (easiest: a Slack/Discord incoming-webhook
  URL, or email via an SMTP relay such as a Gmail app-password). Keep the secret out of git by
  injecting it via `--set` from a GitHub secret in `.github/workflows/deploy-observability.yml`,
  mirroring how the storage-class values are already set.
- Verify the OpenTelemetry migration on a real cluster: (1) confirm a single trace
  spans a gRPC hop (e.g. export-service → invoice-service) in Jaeger — Spring gRPC
  context propagation via Micrometer Observation is assumed but untested; add the
  gRPC observation interceptors if spans don't chain; (2) confirm the FastAPI metric
  name the PrometheusRule keys on (`http_server_request_duration_seconds_*`, pinned
  via `OTEL_SEMCONV_STABILITY_OPT_IN=http`) actually shows up in the collector's
  `:8889/metrics`, and adjust the alert exprs if the emitted name/labels differ.
- Presentation
- Github Actions workflows to execute the tests for each micorservice.