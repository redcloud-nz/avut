/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/--create
 */

import { redirect } from "next/navigation";

import { SkillId } from "@/lib/schemas/skill";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
    context: RouteContext<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/skills/--create`>,
) {
    const { slug, package_id, group_id } = await context.params;

    const skill_id = SkillId.create();

    redirect(
        `/orgs/${slug}/skill-package-builder/packages/${package_id}/groups/${group_id}/skills/${skill_id}/--create`,
    );
}
