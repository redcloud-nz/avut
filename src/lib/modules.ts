/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    CableIcon,
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

/**
 * Canonical identifier for a module.
 *
 * For the settings-gated modules this matches the key under
 * `OrganizationSettings.modules`, so the same id indexes both this registry and
 * the org's enabled flags. `admin` is always-on and has no settings entry.
 */
export type ModuleId =
    | "admin"
    | "d4h-views"
    | "forms"
    | "i3"
    | "notes"
    | "skill-track"
    | "skill-package-builder"
    | "system-admin";

/**
 * Whether a module lives under an organization (`/orgs/[slug]/…`) or is a
 * site-wide area (`/system-admin`) gated on the Better Auth `admin` role.
 */
export type ModuleScope = "organization" | "global";

interface BaseModuleDef {
    id: ModuleId;
    /** Display name shown in nav, dashboard, breadcrumbs, etc. */
    label: string;
    icon: LucideIcon;
    /** Path segment (under `/orgs/[slug]/…` for org modules). Can differ from `id` (e.g. `skills` → `skill-track`). */
    segment: string;
    /** Always available, not gated by org settings (i.e. `admin`). */
    alwaysOn?: boolean;
    scope: ModuleScope;
}

export interface OrganizationModuleDef extends BaseModuleDef {
    scope: "organization";
    /** Builds the org-scoped href. Present only for modules that have a page. */
    href?: (slug: string) => Route;
}

export interface GlobalModuleDef extends BaseModuleDef {
    scope: "global";
    /** Builds the site-wide href. */
    href: () => Route;
}

export type ModuleDef = OrganizationModuleDef | GlobalModuleDef;

/**
 * Single source of truth for the org modules — their names, icons and routes.
 * Insertion order is the display order used by the nav switcher and dashboard.
 */
export const Modules = {
    admin: {
        id: "admin",
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
    "system-admin": {
        id: "system-admin",
        label: "System Admin",
        icon: ShieldIcon,
        segment: "system-admin",
        scope: "global",
        href: () => "/system-admin",
    },
} satisfies Record<ModuleId, ModuleDef>;

/** All modules in display order. */
export const moduleList: readonly ModuleDef[] = Object.values(Modules);

/** Settings-gated module ids (org-scoped modules except always-on `admin`). */
export const configurableModuleIds = moduleList
    .filter(
        (m): m is OrganizationModuleDef & { id: Exclude<ModuleId, "admin" | "system-admin"> } =>
            m.scope === "organization" && m.id !== "admin" && m.id !== "system-admin",
    )
    .map((m) => m.id);

/** An org-scoped module that has a page (appears in the org nav switcher / dashboard). */
export type OrgModuleDef = OrganizationModuleDef & {
    id: Exclude<ModuleId, "system-admin">;
    href: (slug: string) => Route;
};

/**
 * Modules surfaced in the org nav switcher / dashboard, in display order (those with a page).
 * The `id` and `href` narrowing in the predicate is asserted, not inferred from `Boolean(m.href)` —
 * the explicit `m.id !== "system-admin"` check is what backs the `id` exclusion.
 */
export const orgModules = moduleList.filter(
    (m): m is OrgModuleDef =>
        m.scope === "organization" && m.id !== "system-admin" && Boolean(m.href),
);

/** Site-wide modules (gated on the Better Auth `admin` role), in display order. */
export const globalModules = moduleList.filter((m): m is GlobalModuleDef => m.scope === "global");

/** Look up a module by its route segment (as found in the pathname). */
export const moduleBySegment: Record<string, ModuleDef> = Object.fromEntries(
    moduleList.map((m) => [m.segment, m]),
);
