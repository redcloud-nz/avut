/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-nag
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { route } from "@/lib/routes";
import { D4HNag_Rules_List } from "@/modules/d4h-nag/components/rules-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Rules ${TITLE_SEPARATOR} D4H Attendance Reminders`,
};

export default async function D4HNag_Rules_Page(props: PageProps<"/orgs/[slug]/d4h-nag">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    // The layout's `D4HNag_ModuleGate` refuses an org that can't use the module; checked here too
    // so nothing is prefetched (and dehydrated into the page) for one, as the notes layout does.
    if (await isOrganizationModuleUsable(slug, "d4h-nag")) {
        prefetch(trpc.d4hNag.listRules.queryOptions({ organizationId: organization.id }));
    }

    return (
        <HydrateClient>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "D4H Attendance Reminders",
                        href: route("/orgs/[slug]/d4h-nag", { slug }),
                    },
                    { label: "Rules" },
                ]}
            />
            <Std.ScrollContainer>
                <D4HNag_Rules_List />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
