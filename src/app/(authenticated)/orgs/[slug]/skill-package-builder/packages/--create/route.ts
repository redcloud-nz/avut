/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/--create
 */

import { redirect } from "next/navigation";

import { SkillPackageId } from "@/lib/schemas/skill-package";

export async function GET(
    request: Request,
    context: RouteContext<`/orgs/[slug]/skill-package-builder/packages/--create`>,
) {
    const { slug } = await context.params;
    const package_id = SkillPackageId.create();

    redirect(
        `/orgs/${slug}/skill-package-builder/packages/${package_id}/--create`,
    );
}
