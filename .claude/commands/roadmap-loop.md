---
description: Orchestrate the current roadmap milestone (ROAD-03) within a time budget — fresh worker agents per task, one Sonnet review per milestone — then print the command to continue
argument-hint: "[minutes, default 45]"
---

Time budget: $ARGUMENTS minutes. If that is empty or not a number, use 45.

You are the **orchestrator** for the current roadmap milestone (docs/08-roadmap.md ROAD-03). This is a proof of concept: **speed matters most**. You don't edit code, run checks or drive devices yourself: the work goes to fresh agents. Keep your own context small — read only `docs/progress.md` (never `docs/progress-archive.md`), `git log` and the agents' return blocks. Don't use timers, ScheduleWakeup or /loop.

1. Note the start time now, with `date +%H:%M`.
2. Read AGENTS.md and docs/progress.md. If docs/progress.md is missing, let the first worker create it. If an accepted milestone's section is still in docs/progress.md, have the next worker move it to docs/progress-archive.md in its commit.
3. Warm up once, in the background, if the milestone has any UI/device work left: boot the Android emulator and iOS simulator if none is running and start Metro (`npx expo start --dev-client --port 8081`, no `CI=1`), per the local-dev-environment memory. Note the PIDs you started. Pass this state to every agent and tell it to reuse these and leave them up.
4. Loop over the milestone's unfinished tasks:
   - Check the elapsed time with `date +%H:%M`. Once the budget has passed, start no new task; go to step 7.
   - Pick the next unblocked task(s) (ROAD-03 order: domain → data → services → screens → focused tests → Android E2E). **Batch** consecutive non-UI tasks (domain, data, services, providers) into one worker; give each screen or UI task its own worker. Skip tasks blocked on an open question.
   - Spawn a **new** `roadmap-worker` agent in the foreground (`run_in_background: false`; tasks share `main`, Metro and the devices, so never run two at once). Don't pass `model`: it inherits this session's model and effort. Give it: the milestone, the exact task(s), their spec IDs, the remaining time and the Metro/device state.
   - Read its return block and confirm with `git log --oneline origin/main -3` that its commits were pushed.
     - `done`: continue.
     - `blocked`: note the question and continue with the next unblocked task.
     - `failed`: spawn one new worker for the same task, passing its `FAILURE` details. If that fails too, stop and go to step 7.
   - Track every `LEFT RUNNING` process.
5. When a worker reports `ROAD-02 MET: yes` (or every remaining task is done), run **one** review:
   - Spawn a **new** `milestone-reviewer` agent (Sonnet, high effort, set by its definition; don't pass `model`). Give it: the milestone, its spec IDs, the ROAD-02 checklist, the commit range (the milestone's first commit..HEAD) and the Metro/device state. If a previous `docs/qa/<milestone>/review.md` exists, `git mv` it to `review-round<N>.md` first and give the reviewer only the commits since its HEAD.
   - Check that `docs/qa/<milestone>/review.md` was written.
   - Then spawn one new `roadmap-worker` to close out (pass the finding list and the report path). It:
     - fixes every blocker and verifies with `npm run check` and the affected Maestro flows on both platforms. **No second review round.**
     - logs majors and minors as known gaps in docs/progress.md (it may fix a major if it's quick).
     - commits the review report, sets the milestone to "awaiting user acceptance" and adds the ROAD-03 acceptance report to docs/progress.md.
6. Log questions only through workers (they own docs/progress.md edits).
7. Stop every process you started or that's in your `LEFT RUNNING` list, by exact PID (never by pattern), unless I asked to keep them. Then stop and report when any of these happens:
   - the budget has run out
   - the milestone reaches "awaiting user acceptance" (include the ROAD-03 acceptance report)
   - a question needs my decision and nothing unblocked is left
   - a task failed twice

   The report has:
   - a short summary of what was done this session, with commit hashes
   - what's next
   - open questions needing my decision
   - the command to continue, on its own line: `/roadmap-loop $ARGUMENTS`
