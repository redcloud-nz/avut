/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useQuery } from "@tanstack/react-query";

import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";

/**
 * The linked D4H organisation's id when the org's I3 module is set to use organisation-owned D4H
 * records only, otherwise `null` (also when the org has no D4H link, or the link is still
 * loading). Pass it as `organisationOnlyId` to the D4H catalogue selects.
 */
export function useOrganisationOnlyId(): number | null {
    const organization = useOrganization();
    const recordsOnly = organization.settings.modules["d4h-i3"].organisationRecordsOnly;

    const { data: orgD4H } = useQuery(
        trpc.teams.getOrganizationD4H.queryOptions(
            { organizationId: organization.id },
            { enabled: recordsOnly },
        ),
    );

    return recordsOnly ? (orgD4H?.d4hOrganisationId ?? null) : null;
}
