/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[org_slug]/admin/invitations/--create
 */

import { Lexington } from "@/components/blocks/lexington";
import { ToParentPageIcon } from "@/components/icons";
import { S2_Button } from "@/components/ui/s2-button";
import {
    S2_Card,
    S2_CardContent,
    S2_CardHeader,
    S2_CardTitle,
} from "@/components/ui/s2-card";
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
                        <S2_Button variant="outline" asChild>
                            <Link to={Paths.org(slug).admin.invitations}>
                                <ToParentPageIcon /> Invitations
                            </Link>
                        </S2_Button>
                    </Lexington.ColumnControls>
                    <S2_Card>
                        <S2_CardHeader>
                            <S2_CardTitle>Invite new users</S2_CardTitle>
                        </S2_CardHeader>
                        <S2_CardContent>
                            <AdminModule_CreateInvitation_Form
                                organization={organization}
                            />
                        </S2_CardContent>
                    </S2_Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
