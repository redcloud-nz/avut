/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    CableIcon,
    LayoutDashboardIcon,
    NotebookPenIcon,
    PackageIcon,
    PocketKnifeIcon,
    ShieldIcon,
    ShirtIcon,
    UserIcon,
    WrenchIcon,
    type LucideIcon,
} from "lucide-react";
import { Route } from "next";

import { route } from "@/lib/routes";

/**
 * Identifier for an organization-scoped module (lives under `/orgs/[slug]/…`).
 *
 * For the settings-gated ones this matches the key under
 * `OrganizationSettings.modules`, so the same id indexes both this registry and
 * the org's enabled flags. `org-admin` is always-on and has no settings entry.
 */
export type OrganizationModuleId =
    | "org-admin"
    | "d4h-views"
    | "forms"
    | "i3"
    | "notes"
    | "skill-track"
    | "skill-package-builder";

/** Identifier for a user-scoped module (lives under `/user/…`), always available. */
export type UserModuleId = "user-dashboard" | "profile";

/** Identifier for a site-wide module (lives under `/system/…`, gated on the Better Auth `admin` role). */
export type SystemModuleId = "system-admin";

/** Canonical identifier for any module. */
export type ModuleId = OrganizationModuleId | UserModuleId | SystemModuleId;

/**
 * Which of the three real scope roots a module lives under: an organization
 * (`/orgs/[slug]/…`), the current user (`/user/…`, always available), or the
 * site-wide system area (`/system/…`, gated on the Better Auth `admin` role).
 */
export type ModuleScope = "organization" | "user" | "system";

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

export type ModuleDef = OrganizationModuleDef | UserModuleDef | SystemModuleDef;

/**
 * Single source of truth for every module — organization, user, and system — with
 * their names, icons, route segments and hrefs. Insertion order is the display
 * order used by the nav switcher and dashboard. Derive `orgModules` / `userModules`
 * / `systemModules` / `configurableModuleIds` from here rather than hardcoding
 * module ids elsewhere.
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
    "d4h-views": {
        id: "d4h-views",
        label: "D4H Views",
        icon: CableIcon,
        segment: "d4h-views",
        scope: "organization",
        href: (slug) => route("/orgs/[slug]/d4h-views", { slug }),
    },
    forms: {
        id: "forms",
        label: "Forms",
        icon: NotebookPenIcon,
        segment: "forms",
        scope: "organization",
    },
    i3: {
        id: "i3",
        label: "I3",
        icon: ShirtIcon,
        segment: "i3",
        scope: "organization",
        href: (slug) => route("/orgs/[slug]/i3", { slug }),
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
    "user-dashboard": {
        id: "user-dashboard",
        label: "Dashboard",
        icon: LayoutDashboardIcon,
        segment: "",
        alwaysOn: true,
        scope: "user",
        href: () => "/user",
    },
    profile: {
        id: "profile",
        label: "User Settings",
        icon: UserIcon,
        segment: "settings",
        alwaysOn: true,
        scope: "user",
        href: () => "/user/settings",
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

/** Site-wide modules (gated on the Better Auth `admin` role), in display order. */
export const systemModules = moduleList.filter((m): m is SystemModuleDef => m.scope === "system");
