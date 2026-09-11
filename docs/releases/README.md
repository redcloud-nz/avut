# Release notes

One file per release: `v{version}.md`, matching `nz.avut.version` in
`package.json`. It's the hand-written top of the GitHub Release —
[`manage-release-version.yml`](../../.github/workflows/manage-release-version.yml)
passes it as `body_path` and appends GitHub's auto-generated PR list below it
(categorised via [`.github/release.yml`](../../.github/release.yml)).

**The file must exist before `production` is pushed** — the workflow fails the
release if `docs/releases/v{version}.md` is missing or empty. Add it in the
same PR that bumps the version onto `integration` (step 1 of
[`releasing.md`](../releasing.md)); the `/release` skill drafts it for you.

## Format

Keep it short — a sentence or two of framing, then the highlights a reader
cares about. The exhaustive commit/PR list is appended automatically, so don't
reproduce it.

```markdown
## v0.9 (Laburnum)

<One or two sentences: the theme of this release.>

### Highlights

- **<Thing>** — what changed and why it matters.
- **<Thing>** — …

### Upgrade notes

<Anything an operator must do — migrations, env vars, config. Omit the section
if there's nothing.>
```

`### Upgrade notes` earns its place only when there's an action to take.
