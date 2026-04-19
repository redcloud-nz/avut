/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/invitations
 */

import { Lexington } from "@/components/blocks/lexington";

import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";

import { AdminModule_InvitationsList } from "./invitations-list";

export const metadata = {
    title: "Invitations",
};

export default async function AdminModule_InvitationsList_Page(
    props: PageProps<`/main/[slug]/admin/invitations`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    {
                        label: "Admin",
                        href: route("/main/[slug]/admin", { slug }),
                    },
                    "Invitations",
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
