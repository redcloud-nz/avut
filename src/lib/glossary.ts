/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Single source of truth for AVUT's domain glossary. Backs the `/docs/glossary`
 * page and the `<KeyTerms>` callout doc pages opt into via a `keyTerms`
 * frontmatter array. Plain data — no MDX, no rich content — see
 * docs/ideas/2026-09-11-docs-glossary.md for why.
 */

import type { ModuleId } from "@/lib/modules";

export interface GlossaryEntry {
    slug: string;
    term: string;
    /** Shown inline in `<KeyTerms>`. */
    shortDefinition: string;
    /** Shown on the full glossary page. */
    longDefinition: string;
    /** Optional module badges on the glossary page. */
    modules?: ModuleId[];
    /** Slugs of other entries, rendered as "See also" on the glossary page. */
    relatedTerms?: string[];
}

export const glossaryEntries: readonly GlossaryEntry[] = [
    {
        slug: "organization",
        term: "Organization",
        shortDefinition:
            "The account boundary in AVUT — people, data, and modules all belong to one.",
        longDefinition:
            "The top-level unit of access in AVUT. Every person, team, and record belongs to one organization, and the modules an organization has turned on decide what shows up in its sidebar. A user can belong to more than one organization and switch between them.",
        relatedTerms: ["module", "role"],
    },
    {
        slug: "module",
        term: "Module",
        shortDefinition: "A self-contained area of the app that an organization turns on or off.",
        longDefinition:
            "A self-contained area of the app — equipment tracking, skill checks, notes, and so on. Each organization turns on the modules it needs; only enabled modules appear in its sidebar. The Admin module is the one exception: every organization always has it.",
        relatedTerms: ["organization"],
    },
    {
        slug: "role",
        term: "Role",
        shortDefinition: "What a user is allowed to do within an organization.",
        longDefinition:
            "Decides what a signed-in user can do inside an organization. `owner` and `admin` can manage the organization itself; `member` has everyday access; `i3-editor`, `skills-assessor`, and `skill-package-author` grant extra rights scoped to one module each.",
        modules: ["admin"],
        relatedTerms: ["organization", "user", "person"],
    },
    {
        slug: "user",
        term: "User",
        shortDefinition: "An account that can sign in, and the role it holds.",
        longDefinition:
            "An account that can sign in to AVUT, with a role that decides what it can do in an organization. A user is distinct from a person: a person record can exist without a user account attached, and one user can belong to several organizations.",
        modules: ["admin"],
        relatedTerms: ["person", "role"],
    },
    {
        slug: "person",
        term: "Person",
        shortDefinition:
            "A personnel record for someone in the organization, with or without a login.",
        longDefinition:
            "A record representing someone in the organization — a member, volunteer, or contact. A person record can exist on its own, or be linked to a user account that can sign in.",
        relatedTerms: ["user", "role", "team"],
    },
    {
        slug: "team",
        term: "Team",
        shortDefinition: "A grouping of people, used across other modules.",
        longDefinition:
            "A grouping of people within an organization, referenced by other modules — for example, to scope who a skill session or equipment issue applies to.",
        relatedTerms: ["person"],
    },
    {
        slug: "ppe-template",
        term: "PPE template",
        shortDefinition:
            "A standard set of items an I3 issue is built from, with optional size/config variants.",
        longDefinition:
            "Describes a standard set of items — for example, a personal protective equipment (PPE) kit — that I3 issues are built from. A template can have variants for different sizes or configurations, and can be linked to D4H equipment so issued items stay in step with the D4H inventory.",
        modules: ["i3"],
        relatedTerms: ["d4h"],
    },
    {
        slug: "skill-package",
        term: "Skill package",
        shortDefinition: "A reusable collection of skill groups and skills that can be assessed.",
        longDefinition:
            "A collection of skill groups and skills that defines what can be assessed. Packages are authored in the Skill Package Builder and published into the Skill Track catalogue, where other organizations can adopt them. Packages aren't versioned — the published package always reflects its current state.",
        modules: ["skill-track", "skill-package-builder"],
        relatedTerms: ["catalogue", "skill", "skill-group", "skill-check"],
    },
    {
        slug: "skill",
        term: "Skill",
        shortDefinition: "A single assessable capability within a skill package.",
        longDefinition:
            "A single assessable capability defined inside a skill package. Skills are organized into skill groups and are what a skill check actually records an outcome against.",
        modules: ["skill-track", "skill-package-builder"],
        relatedTerms: ["skill-group", "skill-package", "skill-check"],
    },
    {
        slug: "skill-group",
        term: "Skill group",
        shortDefinition: "A named grouping of related skills within a skill package.",
        longDefinition:
            "A named grouping of related skills within a skill package, used to organize a package's skills and structure how reports roll checks up.",
        modules: ["skill-track", "skill-package-builder"],
        relatedTerms: ["skill", "skill-package"],
    },
    {
        slug: "skill-check",
        term: "Skill check",
        shortDefinition:
            "A record that a person was assessed on a skill, with an outcome and a date.",
        longDefinition:
            "A single record that a person was assessed on a skill, with an outcome and a date. Checks done together are grouped into a skill check session. Assessing requires the `skills-assessor` role.",
        modules: ["skill-track"],
        relatedTerms: ["skill-package", "skill-check-session", "assessor", "assessee"],
    },
    {
        slug: "skill-check-session",
        term: "Skill check session",
        shortDefinition: "A group of skill checks done together, e.g. on one training day.",
        longDefinition:
            "Groups the skill checks done together — for example, one assessor working through a group of people on a training day. Reports roll a session's checks up into a matrix so gaps are visible at a glance.",
        modules: ["skill-track"],
        relatedTerms: ["skill-check", "assessor"],
    },
    {
        slug: "assessor",
        term: "Assessor",
        shortDefinition: "The person carrying out a skill check on an assessee.",
        longDefinition:
            "The person carrying out a skill check on an assessee. Assessing requires the `skills-assessor` role. One assessor typically records several checks in a single skill check session.",
        modules: ["skill-track"],
        relatedTerms: ["assessee", "skill-check"],
    },
    {
        slug: "assessee",
        term: "Assessee",
        shortDefinition: "The person being assessed in a skill check.",
        longDefinition:
            "The person a skill check is recorded against — the one being assessed by an assessor. An assessee can view their own results and the reports their role allows.",
        modules: ["skill-track"],
        relatedTerms: ["assessor", "skill-check"],
    },
    {
        slug: "catalogue",
        term: "Skill package catalogue",
        shortDefinition: "The set of skill packages available to an organization in Skill Track.",
        longDefinition:
            "The set of skill packages available to an organization's Skill Track module, drawn from packages published by skill package authors.",
        modules: ["skill-track"],
        relatedTerms: ["skill-package"],
    },
    {
        slug: "d4h",
        term: "D4H",
        shortDefinition:
            "An external platform for team/equipment management; AVUT can optionally connect to it.",
        longDefinition:
            "D4H is an external team- and equipment-management platform. Connecting an organization's D4H access token unlocks read-only D4H Views and lets I3 PPE templates link to D4H equipment. D4H integration is optional — organizations without a token simply don't see D4H-backed data.",
        relatedTerms: ["ppe-template"],
    },
] as const;

export const glossaryBySlug: ReadonlyMap<string, GlossaryEntry> = new Map(
    glossaryEntries.map((entry) => [entry.slug, entry]),
);

/** All entries sorted A-Z by term, for the flat glossary page. */
export function getGlossaryEntriesSorted(): GlossaryEntry[] {
    return [...glossaryEntries].sort((a, b) => a.term.localeCompare(b.term));
}
