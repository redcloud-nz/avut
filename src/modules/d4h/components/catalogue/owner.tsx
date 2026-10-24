/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/** The D4H team or organisation that owns a catalogue record, with its kind in muted text. */
export function D4HModule_Owner({
    owner,
}: {
    owner: { title: string; resourceType: "Team" | "Organisation" };
}) {
    return (
        <>
            <span>{owner.title}</span>
            <span className="text-muted-foreground pl-2">({owner.resourceType})</span>
        </>
    );
}
