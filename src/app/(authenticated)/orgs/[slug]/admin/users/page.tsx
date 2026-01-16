/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users
 */

import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";
import { auth } from "@/server/auth";
import { getOrganizationBySlug } from "@/server/organization";

import { AdminModule_UsersList } from "./users-list";

export default async function AdminModule_UsersList_Page(
    props: PageProps<`/orgs/[slug]/admin/users`>,
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
                    Paths.org(slug).admin.users,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <AdminModule_UsersList
                        organization={organization}
                        currentUserId={session.user.id}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
