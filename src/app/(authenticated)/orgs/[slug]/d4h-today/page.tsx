/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-today
 */

import { Std } from "@/components/blocks/std";

import { D4hToday_Content } from "@/components/d4h-today/d4h-today-content";
import { UserId } from "@/lib/schemas/user";
import { getPersonalD4HAccessTokenForUser } from "@/server/d4h-access-token";
import { requireOrganization } from "@/server/organization-access";
import { requireSession } from "@/server/session";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Today`,
};

export default async function D4hToday_Page(props: PageProps<"/orgs/[slug]/d4h-today">) {
    const { slug } = await props.params;
    const { organization, settings } = await requireOrganization(slug);
    const session = await requireSession();

    let availability: "d4h-disabled" | "no-personal-token" | "ready";
    if (settings.integrations.d4h.enabled === false) {
        availability = "d4h-disabled";
    } else {
        const userId = UserId.schema.parse(session.user.id);
        const token = await getPersonalD4HAccessTokenForUser(organization.id, userId);
        availability = token ? "ready" : "no-personal-token";
    }

    if (availability === "ready") {
        prefetch(trpc.d4hApi.myActivitiesToday.queryOptions({ organizationId: organization.id }));
    }

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <Std.Navbar breadcrumbs={["Today"]} />
                <Std.ScrollContainer>
                    <D4hToday_Content availability={availability} />
                </Std.ScrollContainer>
            </Std.SidebarInset>
        </HydrateClient>
    );
}
