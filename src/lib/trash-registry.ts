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
export type TrashableEntityId = "person" | "team";

interface TrashableEntityDef {
    id: TrashableEntityId;
    /** Singular display label, e.g. "Person" / "Team". */
    label: string;
    /**
     * The `LogEntry.objectType` this entity's rows are logged under — used to batch-resolve
     * "deleted on" from `log_entries` rather than a denormalized column.
     */
    objectType: "Person" | "Team";
    /** The permission resource name — restoring or listing a row gates on `{ [permission]: ["delete"] }`. */
    permission: "person" | "team";
    /** Link to the entity's own detail page. */
    href: (slug: string, id: string) => Route;
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
} satisfies Record<TrashableEntityId, TrashableEntityDef>;

export const trashableEntityList = Object.values(TrashableEntities);
