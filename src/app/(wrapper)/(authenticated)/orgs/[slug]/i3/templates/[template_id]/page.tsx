/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3/templates/[template_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { getOrganizationBySlug } from "@/server/organization";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

import { I3Module_Template_Content } from "./template-content";

type Props = PageProps<"/orgs/[slug]/i3/templates/[template_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, template_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const templateId = I3TemplateId.schema.parse(template_id);
    const template = await fetchQuery(
        trpc.i3.getTemplate.queryOptions({ organizationId: organization.id, templateId }),
    );

    return { title: `${template.name} ${TITLE_SEPARATOR} I3 Templates` };
}

// A server page, so the `?action=` dialogs on this page don't remount it: a client page that read
// its params with `use(props.params)` re-suspended and flashed the page spinner (#76).
export default async function I3Module_Template_Page(props: Props) {
    const { slug, template_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const templateId = I3TemplateId.schema.parse(template_id);

    prefetch(trpc.i3.getTemplate.queryOptions({ organizationId: organization.id, templateId }));

    return (
        <HydrateClient>
            <I3Module_Template_Content templateId={templateId} />
        </HydrateClient>
    );
}
