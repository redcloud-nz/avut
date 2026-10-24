/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { I3TemplateRef } from "@/lib/schemas/i3-template";

import { EntityLink } from "./entity-link";

export type I3TemplateLinkProps = {
    template: I3TemplateRef;
};

export function I3TemplateLink({ template }: I3TemplateLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/d4h-i3/templates/[template_id]", {
                slug: organization.slug,
                template_id: template.id,
            })}
            title={template.name}
            type="Template"
        />
    );
}
