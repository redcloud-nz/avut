/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    CableIcon,
    NotebookPenIcon,
    PackageIcon,
    PocketKnifeIcon,
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
    | "skill-package-builder";

export interface ModuleDef {
    id: ModuleId;
    /** Display name shown in nav, dashboard, breadcrumbs, etc. */
    label: string;
    icon: LucideIcon;
    /** Path segment under `/orgs/[slug]/…`. Note this can differ from `id` (e.g. `skills` → `skill-track`). */
    segment: string;
    /** Always available, not gated by org settings (i.e. `admin`). */
    alwaysOn?: boolean;
    /** Builds the org-scoped href. Present only for modules that have a page. */
    href?: (slug: string) => Route;
}

/**
 * Single source of truth for the org modules — their names, icons and routes.
 * Insertion order is the display order used by the nav switcher and dashboard.
 */
export const Modules: Record<ModuleId, ModuleDef> = {
    admin: {
        id: "admin",
        label: "Admin",
        icon: WrenchIcon,
        segment: "admin",
        alwaysOn: true,
        href: (slug) => route("/orgs/[slug]/admin", { slug }),
    },
    "d4h-views": {
        id: "d4h-views",
        label: "D4H Views",
        icon: CableIcon,
        segment: "d4h-views",
        href: (slug) => route("/orgs/[slug]/d4h-views", { slug }),
    },
    forms: {
        id: "forms",
        label: "Forms",
        icon: NotebookPenIcon,
        segment: "forms",
    },
    i3: {
        id: "i3",
        label: "I3",
        icon: ShirtIcon,
        segment: "i3",
        href: (slug) => route("/orgs/[slug]/i3", { slug }),
    },
    notes: {
        id: "notes",
        label: "Notes",
        icon: NotebookPenIcon,
        segment: "notes",
    },
    "skill-track": {
        id: "skill-track",
        label: "Skill Track",
        icon: PocketKnifeIcon,
        segment: "skill-track",
        href: (slug) => route("/orgs/[slug]/skill-track", { slug }),
    },
    "skill-package-builder": {
        id: "skill-package-builder",
        label: "Skill Package Builder",
        icon: PackageIcon,
        segment: "skill-package-builder",
        href: (slug) => route("/orgs/[slug]/skill-package-builder", { slug }),
    },
};

/** All modules in display order. */
export const moduleList: readonly ModuleDef[] = Object.values(Modules);

/** Settings-gated module ids (everything except always-on modules like `admin`). */
export const configurableModuleIds = moduleList
    .filter((m) => !m.alwaysOn)
    .map((m) => m.id) as Exclude<ModuleId, "admin">[];

/** Modules surfaced in the org nav switcher / dashboard, in display order (those with a page). */
export const orgModules = moduleList.filter(
    (m): m is ModuleDef & { href: (slug: string) => Route } => Boolean(m.href),
);

/** Look up a module by its route segment (as found in the pathname). */
export const moduleBySegment: Record<string, ModuleDef> = Object.fromEntries(
    moduleList.map((m) => [m.segment, m]),
);
