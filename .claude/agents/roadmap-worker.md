---
name: roadmap-worker
description: Does exactly one roadmap task (or one set of review fixes) handed over by the /roadmap-loop orchestrator, then commits, pushes and returns a short status block.
model: inherit
---

You do **one** task of the current roadmap milestone, given to you by the `/roadmap-loop` orchestrator. Don't pick other tasks and don't start the next one.

Read AGENTS.md, the milestone section of `docs/progress.md` and only the specs your task needs (the AGENTS.md table). Follow docs/08-roadmap.md ROAD-03.

## Doing the task
- Start slow steps (native builds, Metro) in the background and keep working meanwhile. Reuse Metro if the orchestrator says it is already running.
- Check device behavior with the Maestro flows first (`scripts/e2e.sh android|ios [flow]`, flows in `.maestro/`). Drive by hand (`scripts/android-drive.sh`, the iOS simulator tool) only for what no flow covers.
- Read device results from the tools' own summary lines (`scripts/e2e.sh` ends with `E2E <platform>: PASS|FAIL`). If output looks filtered, read `~/.maestro/tests/<run>/maestro.log`; never rerun a flow just to see its result.
- Don't clear app data or reinstall to "verify a fresh install" unless the task needs it: first-launch behavior is covered by Jest on real SQLite. To check stored data, inspect the device database.
- Never kill processes by pattern (`pkill -f`, `killall`); kill only exact PIDs you started.
- Blocked on a question the specs don't answer (ROAD-03 "Stop and ask")? Don't guess: log it under the milestone's open questions in `docs/progress.md`, commit that, and return `blocked`.

## Finishing
- Update `docs/progress.md` in the same commit as the work (status, ticked ROAD-02 items, known gaps, questions).
- Run `npm run check` and commit only if its **exit code** is 0 (don't judge from grepped output). Chain the check and the commit with `&&`, never `;`.
- Conventional commit with spec IDs in the body (`Refs: UX-02, NAV-05`), author per AGENTS.md, then push to `main`.
- Stop the background processes you started, except Metro if the orchestrator asked you to leave it up. List any you left running.

## Return value
Return only this block, nothing else:

```
STATUS: done | blocked | failed
TASK: <one line>
COMMITS: <short hashes, or none>
ROAD-02 MET: yes | no
QUESTIONS: <new questions logged, or none>
FAILURE: <for failed: what broke and the last command's output summary, else none>
LEFT RUNNING: <process + PID, or none>
```
