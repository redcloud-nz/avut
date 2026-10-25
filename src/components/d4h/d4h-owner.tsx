/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { D4HTeamLink } from "@/components/entity-links/d4h-team-link";

/**
 * The D4H team or organisation that owns a catalogue record.
 *
 * - `full` (default): the owner, then its kind in muted text. A Team owner links to its page when
 *   `linkable` is true; an Organisation has none.
 * - `compact`: the owner's title alone, in muted text and never a link, for select options and
 *   triggers.
 *
 * Pass `linkable={false}` for a Team the token can't reach, which has no page to link to.
 */
export function D4HOwner({
    owner,
    variant = "full",
    linkable = true,
}: {
    owner: { id: number; title: string; resourceType: "Team" | "Organisation" };
    variant?: "full" | "compact";
    linkable?: boolean;
}) {
    if (variant === "compact") {
        return <span className="text-muted-foreground">{owner.title}</span>;
    }

    return (
        <>
            {owner.resourceType === "Team" && linkable ? (
                <D4HTeamLink team={{ id: owner.id, resourceType: "Team", title: owner.title }} />
            ) : (
                <span>{owner.title}</span>
            )}
            <span className="text-muted-foreground pl-2">({owner.resourceType})</span>
        </>
    );
}
