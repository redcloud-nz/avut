/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { SaratogaBreadcrumb } from "@/components/blocks/saratoga";
import { route } from "@/lib/routes";

/**
 * The start of a Skill Package Builder trail: `Skill Packages › <package>`, then `Groups` or
 * `Skills` for a page under one of those. "Skill Packages" is the ordinary list crumb; the
 * module's index happens to be its list page. "Groups" and "Skills" are an exception to the trail
 * rule: neither has a page of its own, so they link to the package's Contents page, where both
 * are listed.
 */
export function packageBreadcrumbs(
    slug: string,
    skillPackage: { id: string; name: string } | null,
    section?: "Groups" | "Skills",
): SaratogaBreadcrumb[] {
    const items: SaratogaBreadcrumb[] = [
        { label: "Skill Packages", href: route("/orgs/[slug]/skill-package-builder", { slug }) },
    ];
    if (!skillPackage) return items;
    const params = { slug, package_id: skillPackage.id };
    items.push({
        label: skillPackage.name,
        href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", params),
    });
    if (section) {
        items.push({
            label: section,
            href: route(
                "/orgs/[slug]/skill-package-builder/packages/[package_id]/contents",
                params,
            ),
        });
    }
    return items;
}
