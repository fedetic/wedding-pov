# Deferred Items — Phase 06 Native Features

## Pre-existing Lint Errors (Out of Scope for Plan 06-04)

Discovered during: Task 3 (layout.tsx update) — `npm run lint` verification

These errors existed before plan 06-04 and are unrelated to native components:

| File | Line | Rule | Description |
|------|------|------|-------------|
| src/components/events/QRModal.tsx | 23 | react-hooks/set-state-in-effect | setState called synchronously inside useEffect |
| src/components/events/HistoryModal.tsx | 40 | react-hooks/set-state-in-effect | setState called synchronously inside useEffect |
| src/components/events/EventRow.tsx | 24 | @typescript-eslint/no-unused-vars | `_onToggleError` defined but never used |

**Origin:** QRModal error dates to commit 18c70f1 (feat(06-01)). EventRow/HistoryModal errors are from prior phases.

**Resolution:** Fix in a future maintenance plan or before App Store submission.
