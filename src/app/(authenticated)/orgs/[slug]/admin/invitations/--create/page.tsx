/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[org_slug]/admin/invitations/--create
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";

import { AdminModule_CreateInvitation_Form } from "./create-invite";

export const metadata = { title: "Create Invitation" };

export default async function AdminModule_CreateInvitation_Page(
    props: PageProps<"/orgs/[slug]/admin/invitations/--create">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.invitations,
                    Paths.org(slug).admin.invitations.create,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton
                                to={Paths.org(slug).admin.invitations}
                            >
                                Invitations
                            </Hermes.BackButton>
                        </Hermes.Header>
                        <Card>
                            <CardHeader>
                                <CardTitle>Invite new user</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AdminModule_CreateInvitation_Form
                                    organization={organization}
                                />
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
