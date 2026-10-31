/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/categories
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HModule_Categories_List } from "@/modules/d4h/components/catalogue/categories-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: `Equipment Categories ${TITLE_SEPARATOR} D4H` };

export default async function D4HModule_Categories_Page(
    props: PageProps<"/orgs/[slug]/d4h/categories">,
) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    prefetch(trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <D4HModule_Categories_List />
        </HydrateClient>
    );
}
