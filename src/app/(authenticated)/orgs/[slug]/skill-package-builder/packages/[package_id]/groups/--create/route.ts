/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/--create
 */

import { redirect } from "next/navigation";

import { SkillGroupId } from "@/lib/schemas/skill-group";

export async function GET(
    request: Request,
    context: RouteContext<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/--create`>,
) {
    const { slug, package_id } = await context.params;
    const group_id = SkillGroupId.create();

    redirect(
        `/orgs/${slug}/skill-package-builder/packages/${package_id}/groups/${group_id}/--create`,
    );
}
