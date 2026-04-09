/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/users
 */

import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { Lexington } from "@/components/blocks/lexington";

import { route } from "@/lib/routes";
import { auth } from "@/server/auth";
import { getOrganizationBySlug } from "@/server/organization";

import { AdminModule_UsersList } from "./users-list";

export default async function AdminModule_UsersList_Page(
    props: PageProps<`/main/[slug]/admin/users`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });
    if (!session || !session.user) {
        redirect("/auth/sign-in");
    }

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    { label: "Users", href: route("/main/[slug]/admin/users", { slug }) },
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
