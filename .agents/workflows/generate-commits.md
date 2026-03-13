---
description: Analyze uncommitted changes, group them into logical commits, stage files, and generate commit messages following Conventional Commits
---

## Project Context

- **Repo**: MaraMap-Frontend (Owner: KatnessChen)
- **Tech Stack**: TypeScript, React 18, Vite, Chrome Extension MV3
- **Branch convention**: `develop` → `main`

---

## Step 1: Analyze Uncommitted Changes

1. Run `git status` to see all uncommitted files.
2. Run `git diff` to understand each change.
3. Group changes into logical commits using the categories below (in recommended order):

### Commit Categories (recommended order)

1. **`chore` / `ci`** — Config, build pipeline, Docker, environment setup (commit first; lowest risk)
2. **`refactor`** — Code reorganization with no behavior change (commit before features that depend on it)
3. **`feat`** — New features, new API calls, new UI components, new services
4. **`fix`** — Bug fixes, error handling, logic corrections
5. **`docs` / `test`** — Spec updates, README, unit/integration tests (commit last)

### Output Format

Present the analysis as:

```
## Commit Analysis Summary

Found X uncommitted files with the following logical groupings:

---

### Commit #1: <type>(<scope>): <subject>

**Rationale**: <why these changes belong together>

**Files to stage (N files)**:
- <path>: <what changed>

**Dependencies**: <none, or "Requires Commit #X">

**Estimated Impact**: Low / Medium / High

---

[repeat for each commit]

---

## Next Steps

Select a commit number to stage (recommended: start with #1), or:
- Re-analyze with different groupings
- Merge or split commits
- Show detailed diff for a file
```

---

## Step 2: Stage Files (When User Selects a Commit)

When user says "Let's do commit #X" or "Stage #X":

1. Confirm which files will be staged.
2. Run `git add <file>` for each file in the commit.
3. Present the suggested commit message (see format below).

### Commit Message Format (Conventional Commits)

```
<type>(<scope>): <subject>          ← max 72 chars, imperative mood

<body>                              ← WHAT changed and WHY, bullet points

<footer>                            ← optional: BREAKING CHANGE, Closes #N
```

**Example:**
```
feat(scraper): add resume logic to content script

When a scrape session is IN_PROGRESS, the content script now:
- Receives oldest_post_id and oldest_post_date from the popup
- Scrolls to locate the anchor post before collecting newer ones
- Falls back to date-based cutoff if anchor post is not found on page
```

### Output Format

```
## Staging Commit #X: <subject>

**Files staged (N files)**:
✅ <file path>

**Suggested Commit Message**:

<full commit message here>

---

**Next Steps**:
1. Review staged files: `git diff --staged`
2. Commit: `git commit` (paste message above)
3. Or amend if needed: `git commit --amend`

**Remaining**: X more commits
```

---

## Step 3: Partial File Staging (Mixed Changes)

If a file contains changes for more than one commit:

1. Warn the user.
2. Suggest `git add -p <file>` for interactive hunk selection.
3. Specify which hunks belong to which commit.

```
⚠️ `<file>` has changes for multiple commits:
- Commit #2: <description>
- Commit #4: <description>

Use interactive staging:

git add -p <file>

Stage hunks for Commit #2 now, skip the rest for Commit #4.
```

---

## Step 4: Progress Tracking

After each commit is ready, show:

```
## Progress

✅ Done: Commit #1 — <subject>
⏳ Remaining: X commits

**Suggested Next**: Commit #2 — <subject>
```

---

## Step 5: Final Summary

After all commits are staged:

```
## ✅ All Changes Committed!

**Summary**:
- Total commits: N
- Files changed: N

**Commit History**:
1. <subject>
2. <subject>
...

**Recommended Next Steps**:
1. npm run build       ← type check
2. npm run lint
3. git push origin develop
```

---

## Safety Checks (Before Staging)

- ✅ No merge conflicts
- ✅ No debug `console.log` left in source
- ✅ No hardcoded secrets or API keys
- ✅ TypeScript compiles (`npm run build`)

---

## Quick Reference

```bash
git status
git diff
git diff --staged
git add <file>
git add -p <file>          # interactive partial staging
git reset HEAD <file>      # unstage
git commit -m "subject" -m "body"
git commit --amend
git log --oneline -10
npm run build
npm run lint
```

---

## Usage

Say: **"Analyze my changes"** or **"Start commit workflow"** to begin.