/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3/forms/return-items/[instance_id]
 */

import { notFound } from "next/navigation";

import { I3ReturnItemsFormData } from "@/forms/i3-return-items/schema";
import { I3ReturnItemsForm } from "@/lib/forms";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { I3Module_ReturnItems_FormInstance_Content } from "@/modules/i3/components/return-items-form-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function I3Module_Return_FormInstance_Page(
    props: PageProps<"/orgs/[slug]/i3/forms/return-items/[instance_id]">,
) {
    const { slug, instance_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const parsedId = FormInstanceId.schema.safeParse(instance_id);
    if (!parsedId.success) notFound();
    const instanceId = parsedId.data;

    // Awaited: a saved draft's "Returned by" decides which item queries to warm.
    const instances = await fetchQuery(
        trpc.forms.listDraftFormInstances.queryOptions({
            organizationId: organization.id,
            formKey: I3ReturnItemsForm.formKey,
        }),
    );
    const instance = instances.find((inst) => inst.id === instanceId);
    if (!instance) notFound();

    prefetch(trpc.d4hApi.listTeams.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listMembers.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }));

    const recipient = (instance.formData as Partial<I3ReturnItemsFormData>).recipient;
    if (recipient && recipient.id > 0) {
        prefetch(
            trpc.d4hApi.listMemberEquipment.queryOptions({
                organizationId: organization.id,
                teamId: recipient.teamId,
                memberId: recipient.id,
            }),
        );
        prefetch(
            trpc.d4hTasks.listReturnedItemIds.queryOptions({
                organizationId: organization.id,
                teamId: recipient.teamId,
            }),
        );
    }

    return (
        <HydrateClient>
            <I3Module_ReturnItems_FormInstance_Content instanceId={instanceId} />
        </HydrateClient>
    );
}
