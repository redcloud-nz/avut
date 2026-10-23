/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/forms/return-items
 */

import { I3ReturnItemsForm } from "@/lib/forms";
import { I3Module_ReturnItems_FormInstanceList } from "@/modules/i3/components/return-items-form-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function I3Module_Return_FormInstanceList_Page(
    props: PageProps<"/orgs/[slug]/d4h-i3/forms/return-items">,
) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    prefetch(
        trpc.forms.listDraftFormInstances.queryOptions({
            organizationId: organization.id,
            formKey: I3ReturnItemsForm.formKey,
        }),
    );

    return (
        <HydrateClient>
            <I3Module_ReturnItems_FormInstanceList />
        </HydrateClient>
    );
}
