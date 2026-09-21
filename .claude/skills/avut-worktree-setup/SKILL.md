---
name: avut-worktree-setup
description: Set up a freshly created git worktree for AVUT — copy .env.local, link .vercel, npm install, next typegen, and pick a separate dev-server port. Use right after creating or entering a new worktree under .claude/worktrees/.
---

# Setting up a fresh worktree

The scanning tools (`tsc`, `eslint`, `vitest`) already skip `.claude/worktrees/`, so a worktree doesn't disturb the main checkout. But a new worktree is missing every gitignored file, so from the worktree root:

```bash
cp ../../../.env.local .env.local        # shared env — needed by prisma, build, seed, dev server (copy, not symlink, so db:branch can repoint it)
ln -s ../../../.vercel .vercel            # only if using the Vercel CLI / skills
npm install                              # node_modules is gitignored; also required for the pre-commit hook. Runs `prisma generate` via postinstall
npx next typegen                          # .next/ is per-worktree; typed routes won't resolve without this
```

- If the worktree's branch changed `prisma/schema.prisma`, also run `npx prisma generate` (the committed `src/generated/` may be stale).
- Run the dev server on its own port — `npm run dev -- -p 3100` — so it doesn't collide with a dev server in the main checkout (3000, and 3001 for `dev-email`).
- The database is shared (see **Database** above) — a worktree that adds a migration must `npm run db:branch <slug>` before running `migrate dev`. `npm run worktree:remove` drops that copy at teardown; `npm run db:unbranch` does it mid-stream (e.g. once the branch merges but the worktree stays).
- `.claude/settings.local.json` (personal permission allowlist) is not copied; expect more permission prompts until you re-add entries.
