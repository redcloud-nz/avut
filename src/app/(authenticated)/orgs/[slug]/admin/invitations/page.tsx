/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/invitations
 */

import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";
import { auth } from "@/server/auth";
import { getOrganizationBySlug } from "@/server/organization";

import { AdminModule_InvitationsList } from "./invitations-list";

export default async function AdminModule_InvitationsList_Page(
    props: PageProps<`/orgs/[slug]/admin/invitations`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });
    if (!session || !session.user) {
        redirect(Paths.auth.signIn().href);
    }

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.invitations,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <AdminModule_InvitationsList organization={organization} />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
