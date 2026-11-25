/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/kit-checks/new
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { UserId } from "@/lib/schemas/user";
import {
    D4HI3Module_KitCheckNew,
    type KitCheckD4HAvailability,
} from "@/modules/d4h-i3/components/kit-checks/kit-check-new";
import { getPersonalD4HAccessTokenForUser } from "@/server/d4h-access-token";
import { emailDelivery } from "@/server/email";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `New Kit Check ${TITLE_SEPARATOR} Kit Checks`,
};

// Unlinked and for system admins only: `kitChecks` refuses anyone else. The D4H reads need the
// viewer's own personal D4H token, so the page looks it up (as `d4h-today` does) to show a
// "no token" state instead of an error.
export default async function D4HI3Module_KitCheckNew_Page(
    props: PageProps<"/orgs/[slug]/d4h-i3/kit-checks/new">,
) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const { organization, settings, session } = await requireOrganization(slug);

    let availability: KitCheckD4HAvailability;
    if (settings.integrations.d4h.enabled === false) {
        availability = "d4h-disabled";
    } else {
        const userId = UserId.schema.parse(session.user.id);
        const token = await getPersonalD4HAccessTokenForUser(organization.id, userId);
        availability = token ? "ready" : "no-personal-token";
    }

    prefetch(trpc.kitChecks.listBundles.queryOptions({ organizationId: organization.id }));
    if (availability === "ready") {
        prefetch(trpc.kitChecks.listD4HTeams.queryOptions({ organizationId: organization.id }));
    }

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <D4HI3Module_KitCheckNew
                    availability={availability}
                    emailRedirected={emailDelivery() === "redirect"}
                />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
