/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/bundles
 */

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { D4HI3Module_BundleList } from "@/modules/d4h-i3/components/bundles/bundles-list";
import { D4HI3Module_CreateBundle_Dialog } from "@/modules/d4h-i3/components/bundles/create-bundle";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: "I3 Bundles",
};

export default async function D4HI3Module_BundleList_Page(
    props: PageProps<"/orgs/[slug]/d4h-i3/bundles">,
) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    prefetch(trpc.i3Bundles.listBundles.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>I3 Bundles</Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect permissions={{ i3Bundle: ["create"] }}>
                                <D4HI3Module_CreateBundle_Dialog />
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <D4HI3Module_BundleList />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
