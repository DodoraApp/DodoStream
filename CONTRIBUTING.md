# Contributing to DodoStream

Thanks for taking the time to contribute.

## Ways to help

- Report bugs (include reproduction steps + device/platform)
- Request features (explain the user problem and expected UX)
- Improve docs (README, setup notes, screenshots)
- Submit PRs (small, focused changes are easiest to review)

## Development setup

### Prerequisites

- Node.js (LTS recommended)
- `pnpm`
- Expo tooling (Android Studio / Xcode depending on target)

### Install

```bash
pnpm install
```

### Run

```bash
pnpm start
```

### Quality checks

Run the narrowest checks that cover the change while iterating, then run the final applicable gate before opening a PR:

```bash
pnpm typecheck
pnpm exec eslint <changed-file>...
pnpm test -- <path/to/file.test.ts>
pnpm test
pnpm verify:ci
```

Use `pnpm test:e2e:sync*` only when the required real-service credentials and authorization are available. Use the Android E2E commands in [E2E.md](E2E.md) only with an explicitly authorized device session.

## Noteworthy feature release notes

Create a What's New entry for a noteworthy user-facing feature: a major new setting, a new integration or option, or a substantial improvement to an existing flow. Skip minor bug fixes, internal refactors, and cosmetic changes.

Scaffold the entry instead of creating it by hand:

```bash
pnpm new-whats-new "vX.Y.Z" "Feature Name"
```

Then:

1. Replace the template with a short markdown description covering what changed, how to use it, and relevant limitations.
2. For a noteworthy feature, ask the user for a suitable screenshot or illustration and save it beside the entry as `.png`, `.webp`, or `.jpg` using the generated filename.
3. Run `pnpm generate-whats-new` so `src/constants/whats-new/_registry.ts` stays synchronized.

## Project conventions

- Keep changes minimal and focused; avoid drive-by refactors.
- Prefer TypeScript strict correctness.
- Use the existing theme tokens and shared components.
- For TV-interactive UI, use the existing focus primitives/components (for example, `Focusable`).
- For data fetching, prefer the existing React Query hooks.
- Do not hardcode UI strings in components. Use `useTranslation` and add strings to the appropriate namespace in `src/i18n/translations/en/`.

## Translating the app

We welcome translations for any language! To add a new language:

1. Create a new folder `src/i18n/translations/<your-language-code>/`.
2. Copy all JSON files from `src/i18n/translations/en/` to your new folder.
3. Translate the values in the new JSON files. Keep the keys exactly the same.

We use a namespaced JSON structure where each file represents a namespace (for example, `common`, `settings`, `profiles`).

## Submitting changes

1. Fork the repo
2. Create a branch
3. Make a focused change (include tests when the behavior is covered by an existing test layer)
4. Run the applicable focused checks and `pnpm verify:ci` before opening a PR
5. Open a PR with:
   - what changed
   - why
   - how you tested it

## Reporting bugs

Please include:

- Platform (Android TV / Android / tvOS), OS version
- Device model (if relevant)
- Steps to reproduce
- Expected vs actual behavior
- Logs if available
