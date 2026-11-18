/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { I3BundleRef } from "@/lib/schemas/i3-bundle";

import { EntityLink } from "./entity-link";

export type I3BundleLinkProps = {
    bundle: I3BundleRef;
};

export function I3BundleLink({ bundle }: I3BundleLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            // Task 7: link to /orgs/[slug]/d4h-i3/bundles/[bundle_id] once that route exists.
            href={route("/orgs/[slug]/d4h-i3/bundles", { slug: organization.slug })}
            title={bundle.name}
            type="Bundle"
        />
    );
}
