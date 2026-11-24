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
   **Feature requests and to-dos** go in `14-roadmap.md` as R-NNN items, keeping the owner's wording.
5. **`00-provenance.md` is never edited.**
6. **Keep core and runtime separate.** Before writing a spec entry, decide whether it is
   engine-neutral (core document) or specific to one runtime (`spec/runtimes/<runtime>.md`).
   Follow the rules in `05-portability.md`.
7. **License check.** Every new dependency, asset, or build tool is checked against the allowed
   licenses and added to the SBOM or asset register in the same commit (`09-licensing-and-sbom.md` §6).

## AI assistant working rules
- Ask the owner when a choice really belongs to him: anything about how the game looks, feels, or
  plays, and anything about distribution. Choose sensible defaults for purely technical details and
  record them as decisions.
- Read `spec/README.md` and the relevant spec documents before starting work in a new session.
- The repository root `CLAUDE.md` only points to this folder. The rules themselves live here.

## Git
- Default branch is `main`. Make small commits with descriptive messages. Each commit still pairs a
  code change with its spec update.
- Commits made by the AI assistant end with its `Co-Authored-By` attribution line.

### One pull request per working session (D-059)
1. **Start of a session:** update `main` from GitHub, then create a branch named
   `session/YYYY-MM-DD-<short-topic>` from it. All of the session's commits go on that branch.
   Nobody commits directly to `main`.
2. **Push only when the owner asks.** The owner may still be testing or adding changes. Committing
   locally is fine at any time.
3. **When the owner asks to push,** push the branch and open one pull request for the session (as a
   draft if more changes are expected). Its title names the session's main change. Its body lists
   what changed, the decisions recorded (D-numbers), roadmap items touched, and how it was tested.
   Later pushes to the same branch update the same PR. Confirm CI is green on the PR.
4. **The owner merges** when ready, with a **merge commit**, not squash or rebase. This keeps each
   commit, and the decision it records, in `main`'s history, grouped under the session's merge.
   The AI assistant never merges a PR and never pushes to `main`.
5. **After the merge:** delete the branch (on GitHub and locally) and fast-forward local `main`.

## Parallel work (background agents)
- When a background agent is editing files, the main session holds its own edits to the same
  files, drafting them in the scratchpad if needed, and applies them after the agent finishes.
  This avoids overwriting each other's changes.
- When the background work finishes, the main session re-runs the tests, build, and license
  check itself before building on it.

## Commit gate
- Before every commit, run the license check, tests, and build (in that order, as CI does), and
  commit **only if all three pass**. Chain them with `&&` (never `;`), so a failure stops the commit.
- After pushing, confirm the CI run on GitHub is green. A local pass is not proof.
- Stage files deliberately and check `git status` before committing. Never commit `.claude/`
  worktrees or local settings (they are in `.gitignore`).
