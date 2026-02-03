/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users/[org_member_id]/--update
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { AdminModule_UpdateUser_Form } from "./update-user";

export default async function AdminModule_UpdateUser_Page(
    props: PageProps<`/orgs/[slug]/admin/users/[org_member_id]/--update`>,
) {
    const { slug, org_member_id } = use(props.params);
    const organization = useOrganization();

    const { data: organizationMember } = useSuspenseQuery(
        trpc.organizations.getOrganizationUser.queryOptions({
            organizationId: organization.id,
            organizationUserId: org_member_id,
        }),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.users,
                    {
                        label: organizationMember.user.name || "User",
                        href: Paths.org(slug).admin.user(org_member_id).href,
                    },
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={Paths.org(slug).admin.user(org_member_id)}
                            >
                                User
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {organizationMember.user.name || "User"}
                                </CardTitle>
                                <CardDescription>
                                    {organizationMember.user.id}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AdminModule_UpdateUser_Form
                                    organization={organization}
                                    organizationMember={organizationMember}
                                />
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
