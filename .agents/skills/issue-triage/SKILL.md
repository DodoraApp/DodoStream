---
name: issue-triage
description: Rank open GitHub issues and propose the next work. Use when prioritizing the backlog, deciding what to implement next, or reviewing new issues; reads via the readonly `github` server, writes only after user approval.
---

# Issue triage

## Read phase

Use the read-only `github` MCP server. List open issues with their state, labels, and comments. Never use `github-write` in this phase.

## Classify

Classify each issue as bug / feature / chore. Note the affected platform (phone / tablet / tv) from labels or the body. Note repro clarity: are concrete steps present? Is the issue fixture-reproducible?

## Taxonomy proposals

For each issue, prepare a dry-run label payload:

- `type: bug|feature|chore`
- `platform: phone|tablet|tv`
- `repro: clear|unclear|fixture`
- `prio: P1|P2|P3`

Follow the existing repo label style in `.github/ISSUE_TEMPLATE/`. Execute only after explicit user approval via `github-write`. Once the labels exist on enough issues, ranking becomes mechanical label filtering instead of per-issue reasoning.

## Rank

Score each issue: user impact (weight ×3) + frequency signals (+1 per duplicate or mention in comments) + effort estimate (S/M/L; subtract weight for larger effort) + risk. Present a ranked table with per-issue rationale. Map each issue to repo areas via the layout in `AGENTS.md` (`src/components/` domains, `packages/`, `scripts/`).

## Propose

Recommend the next 1–2 items to implement with the reasoning table. For each recommendation, state the skill to use (`bug-reproduction` or `feature-delivery`) and the affected build profiles.

## Write gate

Prepare exact payloads for any proposed write (label to apply, comment text, priority field) as dry runs in the response. Execute only via `github-write` tools after explicit user approval in the same conversation, and only the exact approved payload.
