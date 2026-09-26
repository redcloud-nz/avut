/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Route } from "next";

import { route } from "@/lib/routes";

/**
 * Identifier for an entity type that supports delete/restore-from-trash (#258). Mirrors
 * `src/lib/modules.ts`'s registry shape: a single id-keyed object literal that downstream code
 * derives lists from, rather than a switch statement scattered across call sites.
 */
export type TrashableEntityId = "person" | "team" | "teamMembership" | "i3Template";

interface TrashableEntityDef {
    id: TrashableEntityId;
    /** Singular display label, e.g. "Person" / "Team". */
    label: string;
    /**
     * The `LogEntry.objectType` this entity's rows are logged under — used to batch-resolve
     * "deleted on" from `log_entries` rather than a denormalized column.
     */
    objectType: "Person" | "Team" | "TeamMembership" | "I3Template";
    /** The permission resource name — restoring or listing a row gates on `{ [permission]: ["delete"] }`. */
    permission: "person" | "team" | "i3Template";
    /**
     * Link to the entity's own detail page, or `null` if it doesn't have one addressable by a
     * single id — `TeamMembership`'s detail page is keyed by (teamId, personId), not a single id,
     * so the Rubbish bin renders its name as plain text instead of calling this.
     */
    href: ((slug: string, id: string) => Route) | null;
}

export const TrashableEntities = {
    person: {
        id: "person",
        label: "Person",
        objectType: "Person",
        permission: "person",
        href: (slug, id) =>
            route("/orgs/[slug]/admin/personnel/[person_id]", { slug, person_id: id }),
    },
    team: {
        id: "team",
        label: "Team",
        objectType: "Team",
        permission: "team",
        href: (slug, id) => route("/orgs/[slug]/admin/teams/[team_id]", { slug, team_id: id }),
    },
    teamMembership: {
        id: "teamMembership",
        label: "Team Membership",
        objectType: "TeamMembership",
        permission: "team",
        href: null,
    },
    i3Template: {
        id: "i3Template",
        label: "I3 Template",
        objectType: "I3Template",
        permission: "i3Template",
        href: (slug, id) =>
            route("/orgs/[slug]/i3/templates/[template_id]", { slug, template_id: id }),
    },
} satisfies Record<TrashableEntityId, TrashableEntityDef>;

export const trashableEntityList = Object.values(TrashableEntities);
