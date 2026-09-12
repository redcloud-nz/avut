/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Marketing content for the /tools page — one section per module, richer than the compact
 * grid on the homepage. Deliberately separate from `Modules` in `@/lib/modules` (the app's
 * routing/gating registry): this also needs to describe tools that aren't shipped yet — and
 * some, like "D4H Tools" below, have no corresponding app module at all — which `Modules` has
 * no notion of and shouldn't be made to accommodate.
 */

import { PuzzleIcon, type LucideIcon } from "lucide-react";

import { Modules } from "@/lib/modules";

/**
 * `available` — shipped, no badge shown. `in-development` / `planned` both need a visible
 * badge so a not-yet-real tool is never mistaken for one that works today (see
 * docs/ideas/2026-09-12-tools-index-and-subpages.md).
 */
export type ToolStatus = "available" | "in-development" | "planned";

export interface ToolSection {
    /** Unique slug for this section — a `Modules` id where one applies, otherwise a free slug. */
    id: string;
    label: string;
    icon: LucideIcon;
    status: ToolStatus;
    description: string;
    /** Sub-tools within the section. Omitted for one with nothing built to list yet. */
    tools?: { name: string; description: string }[];
}

/** Display order for the /tools page — matches the homepage's module grid, D4H Tools alongside D4H Views. */
export const TOOLS_CONTENT: readonly ToolSection[] = [
    {
        id: "admin",
        label: Modules.admin.label,
        icon: Modules.admin.icon,
        status: "available",
        description:
            "The organisational backbone every AVUT org runs on. Manage who's in the org, what teams they belong to, and how they connect to D4H — always on, never gated by settings.",
        tools: [
            {
                name: "Users & Teams",
                description: "Manage user accounts, roles and team membership across the org.",
            },
            {
                name: "Personnel",
                description: "The org's own roster — details that live in AVUT, not just D4H.",
            },
            {
                name: "Invitations",
                description: "Invite new members by email and track pending invitations.",
            },
            {
                name: "D4H Access Tokens",
                description: "Connect and manage the read-only tokens behind the D4H integration.",
            },
        ],
    },
    {
        id: "d4h-views",
        label: Modules["d4h-views"].label,
        icon: Modules["d4h-views"].icon,
        status: "in-development",
        description:
            "Read-only views of the D4H data your org already maintains — members, teams and equipment — without re-typing anything or writing back.",
        tools: [
            {
                name: "Members & Teams",
                description: "Browse your D4H personnel and team structure from inside AVUT.",
            },
            {
                name: "Equipment",
                description: "Categories, brands and items synced read-only from D4H Equipment.",
            },
        ],
    },
    {
        id: "d4h-tools",
        label: "D4H Tools",
        icon: PuzzleIcon,
        status: "planned",
        description:
            "Small utilities that plug into D4H for things D4H itself doesn't cover. Ideas so far, not built yet.",
        tools: [
            {
                name: "Shared Calendar",
                description: "A shared calendar across multiple D4H Teams.",
            },
            {
                name: "D4H Nag",
                description:
                    "Set up checks and nags for team members who haven't responded (Attending / Not Attending) to training.",
            },
        ],
    },
    {
        id: "i3",
        label: Modules.i3.label,
        icon: Modules.i3.icon,
        status: "in-development",
        description:
            "Issue, inspect and return equipment and PPE against templates defined per item type, backed by your D4H equipment records.",
        tools: [
            { name: "Issue", description: "Hand out equipment and PPE against a template." },
            { name: "Inspect", description: "Record inspection results for issued items." },
            { name: "Return", description: "Process equipment and PPE returns." },
            {
                name: "PPE Templates",
                description: "Define what gets issued, inspected and returned per item type.",
            },
        ],
    },
    {
        id: "notes",
        label: Modules.notes.label,
        icon: Modules.notes.icon,
        status: "planned",
        description:
            "Rich-text notes that live with the org instead of scattered across someone's inbox or a shared drive. Still an idea on the drawing board — nothing here is built yet.",
    },
    {
        id: "skill-track",
        label: Modules["skill-track"].label,
        icon: Modules["skill-track"].icon,
        status: "available",
        description:
            "Run skill checks and assessment sessions against a catalogue of skill packages, then see who's current with reports sliced by person, skill or team.",
        tools: [
            { name: "Catalogue", description: "The skill packages your org assesses against." },
            { name: "Sessions", description: "Scheduled assessment sessions with a recorder." },
            { name: "Checks", description: "Individual skill check records, pass or fail." },
            {
                name: "Reports",
                description: "Matrix, per-person, per-skill and per-team views of who's current.",
            },
        ],
    },
    {
        id: "skill-package-builder",
        label: Modules["skill-package-builder"].label,
        icon: Modules["skill-package-builder"].icon,
        status: "available",
        description:
            "Author the skill packages your assessors work from, and version them as requirements change.",
        tools: [
            {
                name: "Package Authoring",
                description: "Build out the structure and content of a skill package.",
            },
            {
                name: "Versioning",
                description: "Publish new versions of a package as it evolves.",
            },
        ],
    },
];
