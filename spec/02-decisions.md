# 02 — Decision Log

One entry per decision, numbered `D-NNN`, newest at the bottom. Entries are never deleted. When a later
decision overrides one, the earlier entry is marked **Superseded by D-xxx**.

Template:

```
## D-NNN — Title
- Date: YYYY-MM-DD
- Status: Accepted | Superseded by D-xxx
- Decision: what was decided
- Why: the reasoning and the alternatives considered
```

---

## D-001 — Project location and version control
- Date: 2026-11-23
- Status: Accepted
- Decision: All project files live in `~/dev/proj/freekards`, which is a local git repository with
  `main` as the default branch.
- Why: Requested in the kick-off prompt.

## D-002 — The spec folder is the source of truth
- Date: 2026-11-23
- Status: Accepted
- Decision: `/spec` holds every decision about look, feel, behavior, build, install, runtime, and
  process. It must be complete enough to rebuild the app from it alone. The kick-off prompt is kept
  verbatim in `00-provenance.md`.
- Why: Requested in the kick-off prompt.

## D-003 — Target platforms
- Date: 2026-11-23
- Status: Accepted
- Decision: Windows and Linux, each on ARM64 and x64. The app runs in its own native-feeling window
  and is delivered as an installer the end user can run herself.
- Why: The main device is an ARM Windows tablet, and the old Hoyle app cannot run on ARM.
