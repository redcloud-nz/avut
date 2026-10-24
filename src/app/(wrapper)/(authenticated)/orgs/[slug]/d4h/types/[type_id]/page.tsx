/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/types/[type_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HModule_Type_Content } from "@/modules/d4h/components/catalogue/type-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h/types/[type_id]">;

function parseTypeId(type_id: string) {
    const typeId = Number(type_id);
    if (!Number.isInteger(typeId)) notFound();
    return typeId;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, type_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const typeId = parseTypeId(type_id);

    try {
        const kinds = await fetchQuery(
            trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }),
        );
        const kind = kinds.find((k) => k.id === typeId);
        return { title: `${kind?.title ?? "Type"} ${TITLE_SEPARATOR} D4H` };
    } catch (error) {
        // No D4H token: keep a usable title, and let the page's error boundary explain.
        if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") {
            return { title: `Type ${TITLE_SEPARATOR} D4H` };
        }
        throw error;
    }
}

export default async function D4HModule_Type_Page(props: Props) {
    const { slug, type_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const typeId = parseTypeId(type_id);

    prefetch(trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }));
    prefetch(
        trpc.d4hApi.listEquipmentKindItems.queryOptions({
            organizationId: organization.id,
            kindId: typeId,
        }),
    );

    return (
        <HydrateClient>
            <D4HModule_Type_Content typeId={typeId} />
        </HydrateClient>
    );
}
