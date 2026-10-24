/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { D4HTeamLink } from "@/components/entity-links/d4h-team-link";

/**
 * The D4H team or organisation that owns a catalogue record, with its kind in muted text. A Team
 * owner links to its page; an Organisation has none.
 */
export function D4HModule_Owner({
    owner,
}: {
    owner: { id: number; title: string; resourceType: "Team" | "Organisation" };
}) {
    return (
        <>
            {owner.resourceType === "Team" ? (
                <D4HTeamLink team={{ id: owner.id, resourceType: "Team", title: owner.title }} />
            ) : (
                <span>{owner.title}</span>
            )}
            <span className="text-muted-foreground pl-2">({owner.resourceType})</span>
        </>
    );
}
