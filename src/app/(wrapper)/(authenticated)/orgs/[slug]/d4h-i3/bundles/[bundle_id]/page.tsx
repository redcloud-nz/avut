/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/bundles/[bundle_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { I3BundleId } from "@/lib/schemas/i3-bundle";
import { D4HI3Module_Bundle_Content } from "@/modules/d4h-i3/components/bundles/bundle-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h-i3/bundles/[bundle_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, bundle_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const bundleId = I3BundleId.schema.parse(bundle_id);
    const { bundle } = await fetchQuery(
        trpc.i3Bundles.getBundle.queryOptions({ organizationId: organization.id, bundleId }),
    );

    return { title: `${bundle.name} ${TITLE_SEPARATOR} I3 Bundles` };
}

// A server page, so the `?action=` dialogs on this page don't remount it (#76). It reads no D4H
// data, so it works for an organization with no D4H token.
export default async function D4HI3Module_Bundle_Page(props: Props) {
    const { slug, bundle_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const bundleId = I3BundleId.schema.parse(bundle_id);

    prefetch(trpc.i3Bundles.getBundle.queryOptions({ organizationId: organization.id, bundleId }));

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <D4HI3Module_Bundle_Content bundleId={bundleId} />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
