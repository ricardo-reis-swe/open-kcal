---
description: Work through the current roadmap milestone (ROAD-03) back to back within a time budget, then print the command to continue
argument-hint: "[minutes, default 30]"
---

Time budget: $ARGUMENTS minutes. If that is empty or not a number, use 30.

Work on the current roadmap milestone following docs/08-roadmap.md ROAD-03.

1. Note the start time now, with `date +%H:%M`.
2. Read AGENTS.md and docs/progress.md; create docs/progress.md if it is missing. Pick the next unfinished task of the current milestone.
3. Do the unfinished tasks one after another in this same turn. Don't use timers, ScheduleWakeup or /loop. For each task:
   - do the work
   - run `npm run check` and continue only if its **exit code** is 0 (don't judge from grepped output)
   - update docs/progress.md in the same commit
   - commit (conventional commit with spec IDs in the body) and push to `main`
4. Before starting each new task, check the elapsed time with `date +%H:%M`. Once the budget has passed, start no new task: finish and commit the one in progress, then go to step 7.
5. Skip tasks that are blocked on an open question and do the unblocked ones. Log new questions in docs/progress.md.
6. When ROAD-02 is met, run a **fresh** independent reviewer subagent (read-only, per ROAD-03). Save its output verbatim to `docs/qa/<milestone>/review.md`, fix every blocker and major, and rerun a new reviewer until none remain.
7. Stop and report when any of these happens:
   - the budget has run out
   - the milestone reaches "awaiting user acceptance" (include the ROAD-03 acceptance report)
   - a question needs my decision and nothing unblocked is left

   The report has:
   - a short summary of what was done this session, with commit hashes
   - what's next
   - open questions needing my decision
   - the command to continue, on its own line: `/roadmap-loop $ARGUMENTS`
