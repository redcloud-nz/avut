/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/teams/--create (intercepted)
 */

import { requireOrganization } from "@/server/organization-access";

import { CreateTeam_InterceptedModal } from "./create-team-intercepted-modal";

export default async function AdminModule_CreateTeam_Modal_Page(
    props: PageProps<"/orgs/[slug]/admin/teams/--create">,
) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return <CreateTeam_InterceptedModal />;
}
