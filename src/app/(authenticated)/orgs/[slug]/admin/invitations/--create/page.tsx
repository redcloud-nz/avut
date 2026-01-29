/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[org_slug]/admin/invitations/--create
 */

import { Lexington } from "@/components/blocks/lexington";
import { ToParentPageIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/components/ui/link";

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
                    <Lexington.ColumnControls>
                        <Button variant="outline" asChild>
                            <Link to={Paths.org(slug).admin.invitations}>
                                <ToParentPageIcon /> Invitations
                            </Link>
                        </Button>
                    </Lexington.ColumnControls>
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
