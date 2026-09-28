---
description: Orchestrate the current roadmap milestone (ROAD-03) within a time budget — one fresh worker agent per task, a Sonnet reviewer for QA — then print the command to continue
argument-hint: "[minutes, default 45]"
---

Time budget: $ARGUMENTS minutes. If that is empty or not a number, use 45.

You are the **orchestrator** for the current roadmap milestone (docs/08-roadmap.md ROAD-03). You don't edit code, run checks or drive devices yourself: every task goes to a fresh agent. Keep your own context small — read only `docs/progress.md`, `git log` and the agents' return blocks. Don't use timers, ScheduleWakeup or /loop.

1. Note the start time now, with `date +%H:%M`.
2. Read AGENTS.md and docs/progress.md. If docs/progress.md is missing, let the first worker create it.
3. Loop over the milestone's unfinished tasks, one at a time:
   - Check the elapsed time with `date +%H:%M`. Once the budget has passed, start no new task; go to step 6.
   - Pick the next unblocked task (ROAD-03 order: domain → data → services → screens → focused tests → Android E2E). Skip tasks blocked on an open question.
   - Spawn a **new** `roadmap-worker` agent in the foreground (`run_in_background: false`; tasks share `main`, Metro and the devices, so never run two at once). Don't pass `model`: it inherits this session's model and effort. Give it: the milestone, the exact task, its spec IDs, the remaining time, and the Metro/device state (e.g. "Metro running, PID 1234 — reuse it and leave it up").
   - Read its return block and confirm with `git log --oneline origin/main -3` that its commits were pushed.
     - `done`: continue.
     - `blocked`: note the question and continue with the next unblocked task.
     - `failed`: spawn one new worker for the same task, passing its `FAILURE` details. If that fails too, stop and go to step 6.
   - Track every `LEFT RUNNING` process.
4. When a worker reports `ROAD-02 MET: yes` (or every remaining task is done), run QA:
   - Before a new round, move the previous review with `git mv docs/qa/<milestone>/review.md docs/qa/<milestone>/review-round<N>.md`, and commit and push that.
   - Spawn a **new** `milestone-reviewer` agent (Sonnet, high effort, set by its definition; don't pass `model`). Give it: the milestone, its spec IDs, the ROAD-02 checklist, the commit range (round 1: the milestone's first commit..HEAD; round 2+: the previous review's HEAD..HEAD), the round number, the previous review's path (if any), and the Metro/device state. Round 1 is full, round 2+ is delta, per its definition.
   - If only small fixes remain when the reviewer is due, it may run in the background while a worker finishes them; it reviews the HEAD at its start.
   - Check that `docs/qa/<milestone>/review.md` was written. Commit and push it (`docs(qa): <milestone> review round <N>`).
   - If any blocker or major remains, spawn a new `roadmap-worker` whose task is to fix those findings (pass the finding list and the report path), then run a new reviewer round. Repeat until none remain.
   - When the reviewer passes, spawn a worker to set the milestone to "awaiting user acceptance" in docs/progress.md and draft the ROAD-03 acceptance report there.
5. Log questions only through workers (they own docs/progress.md edits).
6. Stop every process in your `LEFT RUNNING` list by exact PID (never by pattern) unless I asked to keep them. Then stop and report when any of these happens:
   - the budget has run out
   - the milestone reaches "awaiting user acceptance" (include the ROAD-03 acceptance report)
   - a question needs my decision and nothing unblocked is left
   - a task failed twice

   The report has:
   - a short summary of what was done this session, with commit hashes
   - what's next
   - open questions needing my decision
   - the command to continue, on its own line: `/roadmap-loop $ARGUMENTS`
