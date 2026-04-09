/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/admin/organization/--update
 */
"use client";

import { use } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

import { AdminModule_UpdateOrganization_Form } from "./update-organization";

export default function AdminModule_OrganizationUpdate_Page(
    props: PageProps<`/main/[slug]/admin/organization/--update`>,
) {
    const { slug } = use(props.params);

    const organization = useOrganization();

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    {
                        label: "Organization",
                        href: route("/main/[slug]/admin/organization", { slug }),
                    },
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton
                                href={route("/main/[slug]/admin/organization", { slug })}
                                tooltip="Back to Organisation"
                            />
                        </Hermes.Header>
                        <Card>
                            <CardHeader>
                                <CardTitle>Update Organization</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AdminModule_UpdateOrganization_Form
                                    organizationId={organization.id}
                                />
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
