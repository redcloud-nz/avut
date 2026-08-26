/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/--create
 *
 * Non-intercepted fallback for the create-team dialog — reached on a direct load or
 * refresh of the URL (the common case, navigating from the teams list, is instead caught
 * by the intercepting route at `../@modal/(.)--create` and never hits this file). Renders
 * the same teams list as `../page.tsx` with the dialog forced open on top, so the two
 * entry points look identical.
 */

import { AdminModule_CreateTeam_DirectOverlay } from "./create-team-direct-overlay";
import { TeamsListPage } from "../teams-list-page";

export const metadata = {
    title: `Create Team`,
};

export default async function AdminModule_CreateTeam_Page(
    props: PageProps<"/orgs/[slug]/admin/teams/--create">,
) {
    const { slug } = await props.params;

    return (
        <>
            <TeamsListPage slug={slug} />
            <AdminModule_CreateTeam_DirectOverlay />
        </>
    );
}
