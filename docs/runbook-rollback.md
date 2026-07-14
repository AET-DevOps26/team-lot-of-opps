# Runbook: rolling back a bad deploy

## The one thing to remember

`helm rollback` fixes the cluster, not the repo. Every push to `main` auto-deploys
to AET, so a rolled-back cluster silently goes bad again the moment anyone merges
anything. **Roll back first, then open the revert PR.** The rollback buys you the
time to write the revert calmly; it does not replace it.

## Which lever to pull

**The deploy failed on its own.** Nothing to do. `helm upgrade --atomic` waits for
the pods and rolls back by itself if they never go ready. Same for a failed smoke
test — the deploy workflow rolls back and then fails the job red.

**Production is broken and you need it fixed now.** Run the **Rollback** workflow
(`workflow_dispatch`, pick the target, leave `revision` empty for the previous one).
It runs `helm rollback` and re-runs the smoke test. No build, no merge — about a
minute. Then revert the commit on `main`.

**You know exactly which commit was good and want to land there.** Dispatch
**Deploy** with `ref` *and* `image_tag` both pointing at that commit — e.g.
`ref=a1b2c3d`, `image_tag=sha-a1b2c3d`. The build is skipped and the chart comes
from the same commit as the images. Setting `ref` without `image_tag` is rejected:
it would pair an old chart with images built from the dispatch branch, which is the
exact split a rollback is meant to close.

To see what you can roll back to:

```
helm history taxforward -n team-lot-of-opps    # aet
helm history taxforward -n taxforward          # vm
```

Helm keeps the last 10 revisions. Each one stores the chart *and* the values it was
rendered with, so a rollback reverts image tags and template changes together.

## Where rollback stops working: the database

Helm does not roll back Postgres. `invoice-service` and `suggestions-service` run
Flyway with `spring.jpa.hibernate.ddl-auto=validate`, and Flyway Community has no
undo. That gives you one hard rule:

**Additive migrations are safe to roll back. Destructive ones are not.** Adding a
column or table is invisible to the previous app version — `validate` ignores
columns it does not map. Dropping or renaming one strands the old version: it fails
to start, so the pods never go ready, so `--atomic` cannot save you either. You are
then in a forward-fix, not a rollback.

Keep rollback possible by splitting destructive changes across two releases
(expand/contract):

1. Release *N* adds the new column, writes both, reads the old one.
2. Release *N+1* reads the new column.
3. Release *N+2* drops the old column.

At every point, version *N-1* still runs against schema *N*. If a release must
break that rule, say so in the PR — rolling it back means restoring a dump, and
there is currently no automated Postgres backup.

## After the rollback

1. Open the revert PR against `main` and get it merged. Until then, `main` is armed.
2. Check that the revert's own deploy went green.
3. Write down what the smoke test missed. It only asserts that Traefik serves a 2xx
   on `/`. If a broken deploy got past it, that is the gap worth closing.
