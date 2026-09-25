---
description: Work through the current roadmap milestone (ROAD-03) back to back within a time budget, then print the command to continue
argument-hint: "[minutes, default 45]"
---

Time budget: $ARGUMENTS minutes. If that is empty or not a number, use 45.

Work on the current roadmap milestone following docs/08-roadmap.md ROAD-03.

1. Note the start time now, with `date +%H:%M`.
2. Read AGENTS.md and docs/progress.md; create docs/progress.md if it is missing. Pick the next unfinished task of the current milestone.
3. Do the unfinished tasks one after another in this same turn. Don't use timers, ScheduleWakeup or /loop. For each task:
   - do the work. Start slow steps (native builds, Metro) in the background and keep working meanwhile.
   - check device behavior with the Maestro flows first (`scripts/e2e.sh android|ios [flow]`, flows in `.maestro/`). Drive by hand (`scripts/android-drive.sh`, the iOS simulator tool) only for what no flow covers.
   - run `npm run check` and continue only if its **exit code** is 0 (don't judge from grepped output). Chain the check and the commit with `&&`, never `;`.
   - update docs/progress.md in the same commit
   - commit (conventional commit with spec IDs in the body) and push to `main`
4. Before starting each new task, check the elapsed time with `date +%H:%M`. Once the budget has passed, start no new task: finish and commit the one in progress, then go to step 7.
5. Skip tasks that are blocked on an open question and do the unblocked ones. Log new questions in docs/progress.md.
6. When ROAD-02 is met, run a **fresh** independent reviewer subagent (read-only, per ROAD-03):
   - Give it the milestone, its spec IDs, the ROAD-02 checklist, the commit range, the previous review (if any), the device/Metro state, `scripts/e2e.sh` and `scripts/android-drive.sh`. It must reset any device setting it changes.
   - **Round 1 (full):** trace every spec ID to code and tests, run the checks, run the Maestro flows on both platforms and the exit demo.
   - **Round 2+ (delta), with `model: "sonnet"`:** review only the commits since the previous review's HEAD and confirm each earlier finding is fixed. Run `npm run check` and the Maestro flows. Drive devices by hand only for behavior changed since the last review, capped at about 5 minutes; otherwise cite the earlier evidence.
   - If only small fixes remain when the reviewer is due, it may run in the background while you finish them; it reviews the HEAD at its start.
   - Move the previous review to `docs/qa/<milestone>/review-round<N>.md`, save the new output verbatim to `docs/qa/<milestone>/review.md`, fix every blocker and major, and rerun a new reviewer until none remain.
7. Stop background processes you started (Metro, builds) unless I asked to keep them. Then stop and report when any of these happens:
   - the budget has run out
   - the milestone reaches "awaiting user acceptance" (include the ROAD-03 acceptance report)
   - a question needs my decision and nothing unblocked is left

   The report has:
   - a short summary of what was done this session, with commit hashes
   - what's next
   - open questions needing my decision
   - the command to continue, on its own line: `/roadmap-loop $ARGUMENTS`
