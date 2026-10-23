/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3/forms/issue-items/[instance_id]
 */

import { notFound } from "next/navigation";

import { I3IssueItemsForm } from "@/lib/forms";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { I3Module_IssueItems_FormInstance_Content } from "@/modules/i3/components/issue-items-form-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function I3Module_Issue_FormInstance_Page(
    props: PageProps<"/orgs/[slug]/i3/forms/issue-items/[instance_id]">,
) {
    const { slug, instance_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const parsedId = FormInstanceId.schema.safeParse(instance_id);
    if (!parsedId.success) notFound();
    const instanceId = parsedId.data;

    // Awaited, so a missing draft is a 404 rather than a client-side throw.
    const instances = await fetchQuery(
        trpc.forms.listDraftFormInstances.queryOptions({
            organizationId: organization.id,
            formKey: I3IssueItemsForm.formKey,
        }),
    );
    if (!instances.some((inst) => inst.id === instanceId)) notFound();

    prefetch(trpc.d4hApi.listTeams.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listMembers.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.i3.listTemplates.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.i3.listTemplateVariants.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <I3Module_IssueItems_FormInstance_Content instanceId={instanceId} />
        </HydrateClient>
    );
}
