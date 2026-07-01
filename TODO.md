# TODO

- Grafana is now exposed publicly via Traefik at `grafana.<tls.host>` (see
  `infra/helm/templates/traefik-configmap.yaml` / `ingress.yaml`), but it has
  no auth middleware in front of it, unlike the app's `/api/*` routes
  (`firebase-auth`). Decide whether it needs auth or an IP allowlist before
  relying on it publicly.
- Presentation
- Github Actions workflows to execute the tests for each micorservice.