/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions
 */

import { Std } from "@/components/blocks/std";
import SkillTrack_Sessions_List from "@/components/skill-track/sessions-list";
import { requireOrganization } from "@/server/organization-access";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { route } from "@/lib/routes";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Skill Check Sessions ${TITLE_SEPARATOR} Skills Module`,
};

export default async function SkillTrack_Sessions_Page(
    props: PageProps<"/orgs/[slug]/skill-track/sessions">,
) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);

    prefetch(trpc.skills.listSessions.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <Std.Navbar
                    breadcrumbs={[
                        {
                            label: "Skill Track",
                            href: route("/orgs/[slug]/skill-track", { slug }),
                        },
                        {
                            label: "Sessions",
                            href: route("/orgs/[slug]/skill-track/sessions", { slug }),
                        },
                    ]}
                />
                <Std.ScrollContainer>
                    <SkillTrack_Sessions_List />
                </Std.ScrollContainer>
            </Std.SidebarInset>
        </HydrateClient>
    );
}
