/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types/[type_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HI3Module_IssuedType_Content } from "@/modules/d4h-i3/components/issued-types/issued-type-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types/[type_id]">;

function parseId(value: string) {
    const id = Number(value);
    if (!Number.isInteger(id)) notFound();
    return id;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, type_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const typeId = parseId(type_id);

    try {
        const kinds = await fetchQuery(
            trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }),
        );
        const kind = kinds.find((k) => k.id === typeId);
        return { title: `${kind?.title ?? "Issued Type"} ${TITLE_SEPARATOR} D4H I3` };
    } catch (error) {
        // No D4H token: keep a usable title, and let the page's error boundary explain.
        if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") {
            return { title: `Issued Type ${TITLE_SEPARATOR} D4H I3` };
        }
        throw error;
    }
}

export default async function D4HI3Module_IssuedType_Page(props: Props) {
    const { slug, d4h_team_id, type_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const teamId = parseId(d4h_team_id);
    const typeId = parseId(type_id);

    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }));
    prefetch(
        trpc.d4hApi.listTeamIssuedEquipment.queryOptions({
            organizationId: organization.id,
            teamId,
        }),
    );
    prefetch(
        trpc.d4hTasks.listReturnedItemIds.queryOptions({ organizationId: organization.id, teamId }),
    );

    return (
        <HydrateClient>
            <D4HI3Module_IssuedType_Content teamId={teamId} typeId={typeId} />
        </HydrateClient>
    );
}
