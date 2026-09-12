# /tools index page with per-module subpages

**Project:** avut
**Date:** 2026-09-12 21:07

## Idea

Add a public `/tools` page that markets AVUT's modules properly, with a subpage per module (e.g. `/tools/skill-track`, `/tools/i3`). This came up while planning a shared public header/footer for `/`, `/docs`, and `/auth`: the header currently has nowhere to send people to browse modules except the homepage's `#tools` anchor section, and that section is expected to get cramped as the module list grows. A `/tools` index gives the header a stable link target (replacing the `#tools` anchor) and gives each module room for a proper pitch — screenshots, feature bullets, longer copy — instead of one card in a grid.

## Notes

- Content should be registry-driven off `src/lib/modules.ts` (the existing single source of truth for module ids/labels/icons/routes), extended with richer marketing fields per module — longer description, feature bullets, maybe a screenshot — following the same pattern the homepage's module grid already uses (`MODULE_COPY` in `src/app/page.tsx`).
- Scope includes both the index page and per-module subpages as one piece of work, not staged separately.
- Depends on / follows from the shared public header+footer work (tracked in-session, not yet its own issue) — the header's `Docs`/`Tools` link should point here once it exists.
- Want to include subpages for tools that don't exist yet, or are only partially built — pitching where the project is headed, not just what's shipped. These need a clear status indicator (e.g. "Planned" / "In Progress" / "Available") so a hypothetical tool is never mistaken for a real one. Likely means the registry needs a status field per entry, separate from today's `alwaysOn`/module-enablement flags which only make sense for shipped modules.
