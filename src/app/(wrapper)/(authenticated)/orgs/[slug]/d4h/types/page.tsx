/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/types
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HModule_Types_List } from "@/modules/d4h/components/catalogue/types-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: `Types ${TITLE_SEPARATOR} D4H` };

export default async function D4HModule_Types_Page(props: PageProps<"/orgs/[slug]/d4h/types">) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    prefetch(trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <D4HModule_Types_List />
        </HydrateClient>
    );
}
