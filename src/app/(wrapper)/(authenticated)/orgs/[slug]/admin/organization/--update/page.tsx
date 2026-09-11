/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/organization/--update
 */
"use client";

import { use } from "react";

import { Std } from "@/components/blocks/std";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

import { AdminModule_UpdateOrganization_Form } from "./update-organization";

export default function AdminModule_OrganizationUpdate_Page(
    props: PageProps<`/orgs/[slug]/admin/organization/--update`>,
) {
    const { slug } = use(props.params);

    const organization = useOrganization();

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    {
                        label: "Organization",
                        href: route("/orgs/[slug]/admin/organization", { slug }),
                    },
                    "Update",
                ]}
            />
            <Std.ScrollContainer>
                <Card>
                    <CardHeader>
                        <CardTitle>Update Organization</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AdminModule_UpdateOrganization_Form organizationId={organization.id} />
                    </CardContent>
                </Card>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
