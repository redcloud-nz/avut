/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-nag/opt-outs
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { route } from "@/lib/routes";
import { D4HNag_OptOuts_List } from "@/modules/d4h-nag/components/opt-outs-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Opt-outs ${TITLE_SEPARATOR} D4H Attendance Reminders`,
};

export default async function D4HNag_OptOuts_Page(
    props: PageProps<"/orgs/[slug]/d4h-nag/opt-outs">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    // As on the rules page, nothing is prefetched for an org that can't use the module.
    if (await isOrganizationModuleUsable(slug, "d4h-nag")) {
        prefetch(trpc.d4hNag.listOptOuts.queryOptions({ organizationId: organization.id }));
    }

    return (
        <HydrateClient>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "D4H Attendance Reminders",
                        href: route("/orgs/[slug]/d4h-nag", { slug }),
                    },
                    { label: "Opt-outs" },
                ]}
            />
            <Std.ScrollContainer>
                <D4HNag_OptOuts_List />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
