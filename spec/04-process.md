# 04 — Development Process

These rules apply to everyone working on FreeKards, including the AI coding assistant (Claude Code).

## Spec discipline
1. **Every decision goes into `/spec`.** That includes look, feel, behavior, build, packaging,
   install, runtime, and process. Record it in `02-decisions.md`, and also update whichever
   document it affects (requirements, game rules, art, and so on).
2. **Record decisions in the same commit that makes them.** Code and spec must never drift apart.
   A change to behavior with no matching spec update is incomplete.
3. **Rebuildability test.** Before finishing a piece of work, ask: "If the code were lost, could it be
   rebuilt from `/spec`?" If not, add what is missing.
4. **Open questions** go in `03-open-questions.md` until answered, then move to the decision log.
5. **`00-provenance.md` is never edited.**

## AI assistant working rules
- Ask the owner when a choice really belongs to him: anything about how the game looks, feels, or
  plays, and anything about distribution. Choose sensible defaults for purely technical details and
  record them as decisions.
- Read `spec/README.md` and the relevant spec documents before starting work in a new session.
- The repository root `CLAUDE.md` only points to this folder. The rules themselves live here.

## Git
- Default branch is `main`. Make small commits with descriptive messages.
- Commits made by the AI assistant end with its `Co-Authored-By` attribution line.
