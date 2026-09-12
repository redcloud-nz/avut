/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { resolveModuleFlags } from "@/server/module-flags";
import { getOrganizationBySlug } from "@/server/organization";
import { requireOrganization } from "@/server/organization-access";
import { OrganizationProvider } from "@/hooks/use-organization";
import { getServerQueryClient, HydrateClient, prefetch, trpc } from "@/trpc/server";

// NOTE: metadata generation deliberately uses the plain cached lookup rather than
// `requireOrganization` — `generateMetadata` must not redirect. The access check lives in
// the layout below, which is what actually gates rendering.
export async function generateMetadata(props: LayoutProps<"/orgs/[slug]">): Promise<Metadata> {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return {
        title: {
            template: `%s ${TITLE_SEPARATOR} ${organization.name} | AVUT`,
            default: organization.name,
        },
    };
}

export default async function Organization_Layout(props: LayoutProps<"/orgs/[slug]">) {
    const { slug } = await props.params;
    const { organization, settings } = await requireOrganization(slug);
    const moduleFlags = await resolveModuleFlags();

    // `requireOrganization` already did the real fetch for organization/settings (it has to,
    // for the permission check), so seed the query cache with its result directly rather than
    // re-fetching through `prefetch` — `useOrganization`'s `useSuspenseQueries` then hits these
    // on the client instead of firing its own request. Roles weren't part of that fetch (nothing
    // else needed them), so they're a plain `prefetch` instead. `@sidebar/orgs/[slug]/layout.tsx`
    // has none of this to seed (it only calls the plain `getOrganizationBySlug` lookup), so its
    // own `useOrganization` reads either land on these same cache entries or fetch lazily — both
    // fine.
    const queryClient = getServerQueryClient();
    queryClient.setQueryData(
        trpc.organizations.getOrganization.queryKey({ organizationId: organization.id }),
        organization,
    );
    queryClient.setQueryData(
        trpc.settings.getOrganizationSettings.queryKey({ organizationId: organization.id }),
        settings,
    );
    prefetch(trpc.organizations.getMyRoles.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            {/*
             * This is a *separate* `OrganizationProvider` instance from the one the lifted
             * `@sidebar` slot sets up in `(authenticated)/@sidebar/orgs/[slug]/layout.tsx` — both
             * key their `useOrganization` reads by the same `organizationId`, so they share one
             * query-cache entry per query rather than each fetching their own copy.
             */}
            <OrganizationProvider organizationId={organization.id} moduleFlags={moduleFlags}>
                {props.children}
            </OrganizationProvider>
        </HydrateClient>
    );
}
