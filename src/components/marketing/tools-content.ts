/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Marketing content for the /tools page — one section per module, richer than the compact
 * grid on the homepage. Deliberately separate from `Modules` in `@/lib/modules` (the app's
 * routing/gating registry): this also needs to describe tools that aren't shipped yet, which
 * `Modules` has no notion of and shouldn't be made to accommodate.
 */

import { type OrganizationModuleId } from "@/lib/modules";

/**
 * `available` — shipped, no badge shown. `in-development` / `planned` both need a visible
 * badge so a not-yet-real tool is never mistaken for one that works today (see
 * docs/ideas/2026-09-12-tools-index-and-subpages.md).
 */
export type ToolStatus = "available" | "in-development" | "planned";

export interface ToolSection {
    id: Exclude<OrganizationModuleId, "forms">;
    status: ToolStatus;
    description: string;
    /** Sub-tools within the module. Omitted for a module with nothing built to list yet. */
    tools?: { name: string; description: string }[];
}

/** Display order for the /tools page — matches the homepage's module grid. */
export const TOOLS_CONTENT: readonly ToolSection[] = [
    {
        id: "admin",
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
        id: "i3",
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
        status: "planned",
        description:
            "Rich-text notes that live with the org instead of scattered across someone's inbox or a shared drive. Still an idea on the drawing board — nothing here is built yet.",
    },
    {
        id: "skill-track",
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
