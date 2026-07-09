# Team Responsibilities (RACI)

R = Responsible (does the work) · A = Accountable (owns outcomes, final say) ·
C = Consulted (asked for input) · I = Informed (kept in the loop)

Every subsystem gets cross-team review via PRs regardless of the matrix below —
this reflects primary ownership, not exclusive access. See [CODEOWNERS](../CODEOWNERS)
for PR review routing.

| Team member | GitHub | Primary subsystem |
|---|---|---|
| Simon Fritz | `simon-fritz` | Client (React) |
| Lukas Ketzer | `lukasketzer` | Backend (Spring Boot services) + Infra/CI-CD/Observability |
| Tareq | `Tareqahr` | GenAI  |

## Matrix

| Area | Simon | Lukas | Tareq |
|---|---|---|---|
| `client/` (React) | R/A | C | C |
| `services/invoice-service/` (Spring Boot) | I | A | R |
| `services/suggestions-service/` (Spring Boot) | C | R/A | C |
| `services/llm-chat/` (FastAPI, RAG) | I | C | R/A |
| `services/auth-service/` (FastAPI, Firebase) | C | R/A | C |
| `infra/` (Docker Compose, Helm, Terraform, Ansible) | C | R/A | C |
| `.github/workflows/` (CI/CD) | C | R/A | C |
| `infra/monitoring/`, `infra/grafana/`, `infra/prometheus/` (Observability) | I | R/A | I |
| `api/openapi.yaml` (API contract) | C | C | C — jointly owned; changes need agreement from whichever services are affected |
| `docs/` (architecture, schema, diagrams) | C | R/A | C |

## Notes

- Ownership above reflects who currently maintains each area (recent commit activity), not a fixed
  or permanent assignment — it will drift as the project continues and should be updated if it does.
- History note: the AI/business logic now split across `invoice-service` (extraction, categorization),
  `suggestions-service`, and `llm-chat` (RAG, vector store) was originally designed and built by Tareq
  as a single Python service (`ai-components`: OCR extraction, categorization, vector DB, RAG pipeline,
  suggestion engine). Lukas later rearchitected the system into the current microservice split — Java
  `invoice-service`/`suggestions-service` plus Python `llm-chat` — and has maintained the Java services
  since. `auth-service` was built by Lukas as part of that same rearchitecture (Firebase auth + Traefik).
- Integration work (wiring services together, debugging across boundaries, PR review) is a shared
  responsibility for all three members, not just the subsystem owner's.
- Course registration details (GitHub username, TUMonline login, matriculation number) are submitted
  separately via Artemis, not tracked in this repo.
