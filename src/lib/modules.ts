/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    BellRingIcon,
    CableIcon,
    LayoutDashboardIcon,
    NotebookPenIcon,
    PackageIcon,
    PocketKnifeIcon,
    ShieldIcon,
    ShirtIcon,
    WrenchIcon,
    type LucideIcon,
} from "lucide-react";
import { Route } from "next";

import { route } from "@/lib/routes";
import type { UserSettings } from "@/lib/schemas/user-settings";

/**
 * Identifier for an organization-scoped module (lives under `/orgs/[slug]/…`).
 *
 * For the settings-gated ones this matches the key under
 * `OrganizationSettings.modules`, so the same id indexes both this registry and
 * the org's enabled flags. `org-admin` is always-on and has no settings entry.
 */
export type OrganizationModuleId =
    | "org-admin"
    | "d4h"
    | "forms"
    | "d4h-i3"
    | "d4h-nag"
    | "notes"
    | "skill-track"
    | "skill-package-builder";

/** Identifier for a user-scoped module (lives under `/user/…`), always available. */
export type UserModuleId = "user-dashboard" | "user-notes";

/** Identifier for a site-wide module (lives under `/system/…`, gated on the Better Auth `admin` role). */
export type SystemModuleId = "system-admin";

/**
 * Identifier for a team-only module (lives under `/teams/[slug]/…`). An org module that also
 * lives in team scope keeps its `OrganizationModuleId` and declares a `team` entry instead (see
 * {@link OrganizationModuleDef}).
 */
export type TeamModuleId = "team-admin";

/** Canonical identifier for any module. */
export type ModuleId = OrganizationModuleId | TeamModuleId | UserModuleId | SystemModuleId;

/**
 * Which of the four scope roots a module lives under: an organization (`/orgs/[slug]/…`), a
 * team (`/teams/[slug]/…`, reached through a `TeamUser` grant), the current user (`/user/…`,
 * always available), or the site-wide system area (`/system/…`, gated on the Better Auth
 * `admin` role).
 *
 * This is the scope a module is defined in. An org module can also appear in team scope
 * through its `team` entry; its `scope` stays `"organization"`.
 */
export type ModuleScope = "organization" | "team" | "user" | "system";

/** A reference to an org or team scope root by its slug: the two scopes a module can share. */
export type ScopeRef = { scope: "organization" | "team"; slug: string };

/** How an org module also appears in team scope. */
export interface TeamScopeEntry {
    /** Path segment under `/teams/[slug]/`. Defaults to the module's org segment. */
    segment?: string;
    /** Builds the team-scoped href. */
    href: (teamSlug: string) => Route;
}

interface BaseModuleDef {
    /** Display name shown in nav, dashboard, breadcrumbs, etc. */
    label: string;
    icon: LucideIcon;
    /** Path segment under the module's scope root. Can differ from `id` (e.g. `skills` → `skill-track`). */
    segment: string;
    /** Always available, not gated by org settings (i.e. `org-admin`). */
    alwaysOn?: boolean;
    scope: ModuleScope;
}

export interface OrganizationModuleDef extends BaseModuleDef {
    id: OrganizationModuleId;
    scope: "organization";
    /** Builds the org-scoped href. Present only for modules that have a page. */
    href?: (slug: string) => Route;
    /**
     * Another org module this one depends on. The module is usable only while that one is, and
     * the settings write path keeps the pair consistent: turning the required module off turns
     * this one off too, and turning this one on while the required module is off is refused.
     */
    requires?: OrganizationModuleId;
    /**
     * Present when the module also lives in team scope. It's still enabled by its one
     * `OrganizationSettings.modules` key, for the team's org.
     */
    team?: TeamScopeEntry;
}

export interface TeamModuleDef extends BaseModuleDef {
    id: TeamModuleId;
    scope: "team";
    /** Team-only modules have no settings key, so they're always on. */
    alwaysOn: true;
    /** Builds the team-scoped href. */
    href: (teamSlug: string) => Route;
}

export interface UserModuleDef extends BaseModuleDef {
    id: UserModuleId;
    scope: "user";
    /** Builds the user-scoped href. */
    href: () => Route;
}

export interface SystemModuleDef extends BaseModuleDef {
    id: SystemModuleId;
    scope: "system";
    /** Builds the site-wide href. */
    href: () => Route;
}

export type ModuleDef = OrganizationModuleDef | TeamModuleDef | UserModuleDef | SystemModuleDef;

/**
 * Single source of truth for every module — organization, team, user, and system — with
 * their names, icons, route segments and hrefs. Insertion order is the display
 * order used by the nav switcher and dashboard. Derive `orgModules` / `teamModules` /
 * `userModules` / `systemModules` / `configurableModuleIds` from here rather than
 * hardcoding module ids elsewhere.
 */
export const Modules = {
    "org-admin": {
        id: "org-admin",
        label: "Admin",
        icon: WrenchIcon,
        segment: "admin",
        alwaysOn: true,
        scope: "organization",
        href: (slug) => route("/orgs/[slug]/admin", { slug }),
    },
    d4h: {
        id: "d4h",
        label: "D4H",
        icon: CableIcon,
        segment: "d4h",
        scope: "organization",
        href: (slug) => route("/orgs/[slug]/d4h", { slug }),
    },
    forms: {
        id: "forms",
        label: "Forms",
        icon: NotebookPenIcon,
        segment: "forms",
        scope: "organization",
    },
    "d4h-i3": {
        id: "d4h-i3",
        label: "D4H I3",
        icon: ShirtIcon,
        segment: "d4h-i3",
        scope: "organization",
        requires: "d4h",
        href: (slug) => route("/orgs/[slug]/d4h-i3", { slug }),
    },
    "d4h-nag": {
        id: "d4h-nag",
        label: "D4H Attendance Reminders",
        icon: BellRingIcon,
        segment: "d4h-nag",
        scope: "organization",
        requires: "d4h",
        href: (slug) => route("/orgs/[slug]/d4h-nag", { slug }),
    },
    notes: {
        id: "notes",
        label: "Notes",
        icon: NotebookPenIcon,
        segment: "notes",
        scope: "organization",
        href: (slug) => route("/orgs/[slug]/notes", { slug }),
    },
    "skill-track": {
        id: "skill-track",
        label: "Skill Track",
        icon: PocketKnifeIcon,
        segment: "skill-track",
        scope: "organization",
        href: (slug) => route("/orgs/[slug]/skill-track", { slug }),
    },
    "skill-package-builder": {
        id: "skill-package-builder",
        label: "Skill Package Builder",
        icon: PackageIcon,
        segment: "skill-package-builder",
        scope: "organization",
        href: (slug) => route("/orgs/[slug]/skill-package-builder", { slug }),
    },
    "team-admin": {
        id: "team-admin",
        label: "Admin",
        icon: WrenchIcon,
        segment: "admin",
        alwaysOn: true,
        scope: "team",
        href: (teamSlug) => route("/teams/[slug]/admin", { slug: teamSlug }),
    },
    "user-dashboard": {
        id: "user-dashboard",
        label: "Dashboard",
        icon: LayoutDashboardIcon,
        // Empty because this module *is* the `/user` scope root, not a sub-page under it.
        segment: "",
        alwaysOn: true,
        scope: "user",
        href: () => "/user",
    },
    "user-notes": {
        id: "user-notes",
        label: "Notes",
        icon: NotebookPenIcon,
        segment: "notes",
        alwaysOn: true,
        scope: "user",
        href: () => "/user/notes",
    },
    "system-admin": {
        id: "system-admin",
        label: "System Admin",
        icon: ShieldIcon,
        segment: "admin",
        scope: "system",
        href: () => "/system/admin",
    },
} satisfies Record<ModuleId, ModuleDef>;

/** All modules in display order. */
export const moduleList: readonly ModuleDef[] = Object.values(Modules);

/**
 * The module `moduleId` requires, if any. Read through an `OrganizationModuleDef`-typed lookup
 * because most registry entries have no `requires` property under `satisfies`.
 */
export function requiredModuleOf(moduleId: OrganizationModuleId): OrganizationModuleId | undefined {
    const moduleDef: OrganizationModuleDef = Modules[moduleId];
    return moduleDef.requires;
}

/** The org modules whose `requires` is `moduleId`, in display order. */
export function modulesRequiring(moduleId: OrganizationModuleId): OrganizationModuleId[] {
    return moduleList
        .filter((m): m is OrganizationModuleDef => m.scope === "organization")
        .filter((m) => m.requires === moduleId)
        .map((m) => m.id);
}

/** Settings-gated module ids (org-scoped modules except always-on `org-admin`). */
export const configurableModuleIds = moduleList
    .filter(
        (m): m is OrganizationModuleDef & { id: Exclude<OrganizationModuleId, "org-admin"> } =>
            m.scope === "organization" && m.id !== "org-admin",
    )
    .map((m) => m.id);

/** An org-scoped module that has a page (appears in the org nav switcher / dashboard). */
export type OrgModuleDef = OrganizationModuleDef & {
    href: (slug: string) => Route;
};

/**
 * Modules surfaced in the org nav switcher / dashboard, in display order (those with a page).
 * `scope: "organization"` discriminates `m` to `OrganizationModuleDef` (so `m.id` is an
 * `OrganizationModuleId`); `Boolean(m.href)` is the only extra narrowing needed.
 */
export const orgModules = moduleList.filter(
    (m): m is OrgModuleDef => m.scope === "organization" && Boolean(m.href),
);

/** User-scoped modules (always available), in display order. */
export const userModules = moduleList.filter((m): m is UserModuleDef => m.scope === "user");

/** The id of a user module that isn't `alwaysOn`, derived from the registry. */
type NonAlwaysOnUserModuleId = {
    [K in keyof typeof Modules]: (typeof Modules)[K] extends { scope: "user" }
        ? (typeof Modules)[K] extends { alwaysOn: true }
            ? never
            : K
        : never;
}[keyof typeof Modules];

/** A user module id with a `UserSettings.modules` entry, i.e. one that can be configured. */
export type ConfigurableUserModuleId = keyof UserSettings["modules"];

/**
 * Compile-time check that every user module that isn't `alwaysOn` has a `UserSettings.modules`
 * entry, which is what the type guard on {@link configurableUserModules} relies on. Registering
 * such a module without adding its settings entry fails here.
 */
type AssertTrue<T extends true> = T;
export type _EveryConfigurableUserModuleHasSettings = AssertTrue<
    [NonAlwaysOnUserModuleId] extends [ConfigurableUserModuleId] ? true : false
>;

/**
 * User-scoped modules with per-user configurable settings — i.e. not `alwaysOn`. Empty today
 * (every user module is `alwaysOn`), so `UserSettings.modules` has nothing worth surfacing in
 * the preferences UI yet; see `UserModules_SettingsCard`.
 */
export const configurableUserModules = userModules.filter(
    (m): m is UserModuleDef & { id: ConfigurableUserModuleId } => !m.alwaysOn,
);

/** The ids of {@link configurableUserModules}. */
export const configurableUserModuleIds = configurableUserModules.map((m) => m.id);

/** Site-wide modules (gated on the Better Auth `admin` role), in display order. */
export const systemModules = moduleList.filter((m): m is SystemModuleDef => m.scope === "system");

/** Fields every {@link TeamScopedModule} carries, whichever registry entry it came from. */
interface TeamScopedModuleBase {
    label: string;
    icon: LucideIcon;
    /** Path segment under `/teams/[slug]/`. */
    segment: string;
    href: (teamSlug: string) => Route;
}

/**
 * A module as it appears in team scope: a team-only module, or an org module with a `team`
 * entry. One that isn't `alwaysOn` is always an org module, so its id can go to
 * `isModuleEnabled` (`m.alwaysOn || isModuleEnabled(m.id)`).
 */
export type TeamScopedModule = TeamScopedModuleBase &
    (
        | { id: TeamModuleId | OrganizationModuleId; alwaysOn: true }
        | { id: OrganizationModuleId; alwaysOn: false }
    );

/**
 * The modules that appear in team scope, in `list` order: every `scope: "team"` module plus
 * every org module with a `team` entry. Pure, so a test can feed it fixtures; use
 * {@link teamModules} for the real registry.
 */
export function deriveTeamModules(list: readonly ModuleDef[]): TeamScopedModule[] {
    return list.flatMap((m): TeamScopedModule[] => {
        if (m.scope === "team") {
            return [
                {
                    id: m.id,
                    label: m.label,
                    icon: m.icon,
                    segment: m.segment,
                    alwaysOn: true,
                    href: m.href,
                },
            ];
        }
        if (m.scope === "organization" && m.team) {
            const base = {
                label: m.label,
                icon: m.icon,
                segment: m.team.segment ?? m.segment,
                href: m.team.href,
            };
            return [
                m.alwaysOn
                    ? { ...base, id: m.id, alwaysOn: true }
                    : { ...base, id: m.id, alwaysOn: false },
            ];
        }
        return [];
    });
}

/** Modules surfaced in team scope (the team sidebar), in display order. */
export const teamModules = deriveTeamModules(moduleList);

/**
 * The root href of `moduleDef` in the scope `ref` names, or `undefined` when the module doesn't
 * live in that scope (or, in org scope, has no page). Pure; {@link moduleHref} looks the
 * module up in the registry.
 */
export function moduleDefHref(moduleDef: ModuleDef, ref: ScopeRef): Route | undefined {
    if (ref.scope === "organization") {
        return moduleDef.scope === "organization" ? moduleDef.href?.(ref.slug) : undefined;
    }
    if (moduleDef.scope === "team") return moduleDef.href(ref.slug);
    if (moduleDef.scope === "organization") return moduleDef.team?.href(ref.slug);
    return undefined;
}

/** The root href of module `moduleId` in the org or team scope `ref` names, if it lives there. */
export function moduleHref(moduleId: ModuleId, ref: ScopeRef): Route | undefined {
    return moduleDefHref(Modules[moduleId], ref);
}
