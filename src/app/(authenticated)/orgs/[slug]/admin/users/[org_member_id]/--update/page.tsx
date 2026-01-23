/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users/[org_member_id]/--update
 */

import { notFound } from "next/navigation";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import {
    S2_Card,
    S2_CardContent,
    S2_CardDescription,
    S2_CardHeader,
    S2_CardTitle,
} from "@/components/ui/s2-card";
import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import prisma from "@/server/prisma";

import { AdminModule_UpdateUser_Form } from "./update-user";
import { OrganizationMemberId } from "@/lib/schemas/organization-member";

export const metadata = { title: "Update User Role" };

export default async function AdminModule_UpdateUser_Page(
    props: PageProps<`/orgs/[slug]/admin/users/[org_member_id]/--update`>,
) {
    const { slug, org_member_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const organizationMember = await prisma.organizationMember.findUnique({
        where: {
            id: org_member_id,
            organizationId: organization.id,
        },
        include: { user: true },
    });

    if (!organizationMember) {
        notFound();
    }

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
                    "Update Role",
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
                        <S2_Card>
                            <S2_CardHeader>
                                <S2_CardTitle>
                                    {organizationMember.user.name || "User"}
                                </S2_CardTitle>
                                <S2_CardDescription>
                                    {organizationMember.user.id}
                                </S2_CardDescription>
                            </S2_CardHeader>
                            <S2_CardContent>
                                <AdminModule_UpdateUser_Form
                                    organization={organization}
                                    organizationMemberId={OrganizationMemberId.schema.parse(
                                        org_member_id,
                                    )}
                                />
                            </S2_CardContent>
                        </S2_Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
