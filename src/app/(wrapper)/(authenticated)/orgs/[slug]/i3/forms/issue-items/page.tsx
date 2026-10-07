/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3/forms/issue-items
 */

import { I3Module_IssueItems_FormInstanceList } from "@/components/i3/issue-items-form-list";
import { I3IssueItemsForm } from "@/lib/forms";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function I3Module_Issue_FormInstanceList_Page(
    props: PageProps<"/orgs/[slug]/i3/forms/issue-items">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    prefetch(
        trpc.forms.listDraftFormInstances.queryOptions({
            organizationId: organization.id,
            formKey: I3IssueItemsForm.formKey,
        }),
    );

    return (
        <HydrateClient>
            <I3Module_IssueItems_FormInstanceList />
        </HydrateClient>
    );
}
