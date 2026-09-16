---
name: pr-handoff
description: Prepare the branch, title, and draft PR body for substantive finished work. Use when a change touching runtime code, tests, build config, or behavior-impacting docs is verified and ready for review; output is a PR-ready block, created only after user approval.
---

# PR handoff

## Collect

- Branch name suggestion: `fix|feat/<scope>-<slug>`.
- PR title in Conventional Commit style referencing the owning issue (`fix: #195 ...`).
- Draft body assembled from the slice evidence structure (Implemented / Checkpoints / Verified / Not run / Remaining concerns), matching `.github/PULL_REQUEST_TEMPLATE.md`.

## Emit

Emit the complete block (branch, title, body) in one fenced markdown chunk so the user can review the exact payload.

## Write gate

Create the branch and PR via `github-write` only after explicit user approval of that exact block in the same conversation. Never push directly, never merge, never approve a PR — review and merge are human phases.
