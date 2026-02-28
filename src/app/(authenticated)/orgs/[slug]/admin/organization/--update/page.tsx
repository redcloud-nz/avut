/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/organization/--update
 */
"use client";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { AdminModule_UpdateOrganization_Form } from "./update-organization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminModule_OrganizationUpdate_Page(
    props: PageProps<`/orgs/[slug]/admin/organization/--update`>,
) {
    const organization = useOrganization();

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(organization.slug).admin.index,
                    Paths.org(organization.slug).admin.organization,
                    Paths.org(organization.slug).admin.organization.update,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton
                                to={
                                    Paths.org(organization.slug).admin
                                        .organization
                                }
                            >
                                {organization.name}
                            </Hermes.BackButton>
                        </Hermes.Header>
                        <Card>
                            <CardHeader>
                                <CardTitle>Update Organization</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AdminModule_UpdateOrganization_Form
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
