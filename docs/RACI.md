# Team Responsibilities (RACI)

R = Responsible (does the work) · A = Accountable (owns outcomes, final say) ·
C = Consulted (asked for input) · I = Informed (kept in the loop)

Every subsystem gets cross-team review via PRs regardless of the matrix below —
this reflects primary ownership, not exclusive access. See [CODEOWNERS](../CODEOWNERS)
for PR review routing.

| Team member | GitHub | Primary subsystem |
|---|---|---|
| Simon Fritz | `simon-fritz` | Suggestions Service, Export Service, Client (React) |
| Lukas Ketzer | `lukasketzer` | Kubernetes Infrastructure (Helm/Terraform/Ansible), Invoice Service, Chat-Agent |
| Tareq | `Tareqahr` | Invoice-Service Extraction (OCR/categorization), GenAI RAG (`llm-chat`) |

## Matrix

| Area | Simon | Lukas | Tareq |
|---|---|---|---|
| `client/` (React) | R/A | C | C |
| `services/suggestions-service/` (Spring Boot) | R/A | C | C |
| `services/invoice-service/` (Spring Boot, core service) | C | R/A | C |
| `services/invoice-service/.../ExtractionService` (OCR/categorization) | I | C | R/A |
| `services/llm-chat/` — Chat-Agent (orchestration, `agent.py`/`main.py`) | I | R/A | C |
| `services/llm-chat/` — RAG/vector store (`vector_store.py`) | I | C | R/A |
| `services/auth-service/` (FastAPI, Firebase) | C | R/A | C |
| `infra/` (Kubernetes, Helm, Terraform, Ansible) | I | R/A | I |
| `.github/workflows/` (CI/CD) | C | R/A | C |
| `infra/monitoring/`, `infra/grafana/`, `infra/prometheus/` (Observability) | I | R/A | I |
| `api/openapi.yaml` (API contract) | C | C | C — jointly owned; changes need agreement from whichever services are affected |
| `docs/` (architecture, schema, diagrams) | R/A | R/A | R/A |

## Notes

- Ownership above reflects who currently maintains each area (recent commit activity), not a fixed
  or permanent assignment — it will drift as the project continues and should be updated if it does.
- History note: the AI/business logic now split across `invoice-service`'s `ExtractionService`
  (OCR, categorization) and `llm-chat`'s RAG/vector store was originally designed and built by
  Tareq as a single Python service (`ai-components`: OCR extraction, categorization, vector DB,
  RAG pipeline, suggestion engine). Lukas later rearchitected the system into the current
  microservice split — Java `invoice-service`/`suggestions-service` plus Python `llm-chat` — and
  maintains `invoice-service` core and `auth-service` since. `suggestions-service` is currently
  owned by Simon; `llm-chat`'s chat-agent orchestration is shared between Lukas and Tareq, with
  Tareq owning the RAG/vector-store logic specifically.
- Integration work (wiring services together, debugging across boundaries, PR review) is a shared
  responsibility for all three members, not just the subsystem owner's.
- Course registration details (GitHub username, TUMonline login, matriculation number) are submitted
  separately via Artemis, not tracked in this repo.
