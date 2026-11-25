/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/kit-checks/[kit_check_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { KitCheckId } from "@/lib/schemas/kit-check";
import { D4HI3Module_KitCheck_Content } from "@/modules/d4h-i3/components/kit-checks/kit-check-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h-i3/kit-checks/[kit_check_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, kit_check_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const kitCheckId = KitCheckId.schema.parse(kit_check_id);
    const kitCheck = await fetchQuery(
        trpc.kitChecks.getKitCheck.queryOptions({ organizationId: organization.id, kitCheckId }),
    );

    return { title: `${kitCheck.bundleName} ${TITLE_SEPARATOR} Kit Checks` };
}

// Unlinked and for system admins only: `kitChecks` refuses anyone else.
export default async function D4HI3Module_KitCheck_Page(props: Props) {
    const { slug, kit_check_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const kitCheckId = KitCheckId.schema.parse(kit_check_id);

    prefetch(
        trpc.kitChecks.getKitCheck.queryOptions({ organizationId: organization.id, kitCheckId }),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <D4HI3Module_KitCheck_Content kitCheckId={kitCheckId} />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
