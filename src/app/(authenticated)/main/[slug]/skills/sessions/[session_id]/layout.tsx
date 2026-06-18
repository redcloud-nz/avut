/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/organization";
import { getSkillCheckSessionById } from "@/server/skill-check-session";

export async function generateMetadata(
    props: LayoutProps<"/main/[slug]/skills/sessions/[session_id]">,
): Promise<Metadata> {
    const { slug, session_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const session = (await getSkillCheckSessionById(organization.id, session_id)) ?? notFound();

    return {
        title: `${session.name || `Session ${session.id}`} ${TITLE_SEPARATOR} Skills Module`,
    };
}

export default async function SkillsModule_Session_Layout(
    props: LayoutProps<"/main/[slug]/skills/sessions/[session_id]">,
) {
    return <>{props.children}</>;
}
