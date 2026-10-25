/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { isOwnedByOrganisation } from "@/lib/i3-template-fit";

/** A D4H catalogue record's owner, with its title resolved (see `resolveCatalogueOwner`). */
export type CatalogueOptionOwner = {
    id: number;
    resourceType: "Team" | "Organisation";
    title: string;
};

/** A D4H catalogue record (category, kind, brand or model), as far as a picker reads it. */
export type CatalogueOptionRecord = { id: number; title: string; owner: CatalogueOptionOwner };

export type CatalogueOption<T extends CatalogueOptionRecord> = {
    record: T;
    /**
     * True for a selected record that the organisation-only filter would have dropped: it's kept
     * so an existing selection survives, and marked as not owned by the organisation.
     */
    otherOwnerMarker: boolean;
};

export type CatalogueOptionGroup<T extends CatalogueOptionRecord> = {
    owner: CatalogueOptionOwner;
    options: CatalogueOption<T>[];
};

function ownerKey(owner: CatalogueOptionOwner): string {
    return `${owner.resourceType}:${owner.id}`;
}

/**
 * Groups D4H catalogue records by owner, for a picker: organisation owners first, then teams,
 * each A–Z by title, with records A–Z inside each group.
 *
 * When `organisationOnlyId` isn't null, only records owned by that D4H organisation are kept,
 * plus the record with `selectedId`, which stays with `otherOwnerMarker: true`.
 */
export function groupCatalogueOptions<T extends CatalogueOptionRecord>(
    records: readonly T[],
    {
        organisationOnlyId,
        selectedId,
    }: { organisationOnlyId: number | null; selectedId: number | null },
): CatalogueOptionGroup<T>[] {
    const groups = new Map<string, CatalogueOptionGroup<T>>();

    for (const record of records) {
        const otherOwner =
            organisationOnlyId != null && !isOwnedByOrganisation(record.owner, organisationOnlyId);
        if (otherOwner && record.id !== selectedId) continue;

        const key = ownerKey(record.owner);
        let group = groups.get(key);
        if (!group) {
            group = { owner: record.owner, options: [] };
            groups.set(key, group);
        }
        group.options.push({ record, otherOwnerMarker: otherOwner });
    }

    return Array.from(groups.values())
        .toSorted((a, b) => {
            if (a.owner.resourceType !== b.owner.resourceType) {
                return a.owner.resourceType === "Organisation" ? -1 : 1;
            }
            return a.owner.title.localeCompare(b.owner.title);
        })
        .map((group) => ({
            ...group,
            options: group.options.toSorted((a, b) => a.record.title.localeCompare(b.record.title)),
        }));
}
