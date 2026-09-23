# Docs

Where things live. Each folder with conventions of its own has a README.

## Read before you build

- [`patterns/`](patterns/) — how a recurring piece of the app is written (detail pages, mutation dialogs, `Protect` gating, transactional writes, `Field` layout). Read the relevant one before writing a new page or mutation rather than copying a neighbouring file.
- [`modules/`](modules/) — what each module does and how it is meant to behave (Skills, Skill Package Builder, Drive).

## Design record

- [`specs/`](specs/README.md) — the agreed shape of a non-trivial change before it is built, and why it is that shape once built. Every spec carries a date and a status.
- [`plans/`](plans/) — the sequence of steps for one piece of work.
- [`research/`](research/) — investigations of something external, such as a library's behaviour.
- [`reviews/`](reviews/README.md) — cross-cutting reviews of code that already exists: what is wrong with it and what to do about it. Dated.

## Releasing

- [`releasing.md`](releasing.md) — how a version gets from `integration` to `production`.
- [`releases/`](releases/README.md) — one hand-written note per release, `v{version}.md`. It must exist before `production` is pushed.
- [`version-names.md`](version-names.md) — proposed codenames for releases; pick the next unused one.
- [`branch-protection.md`](branch-protection.md) — the branch rules for `integration` and `production`.
