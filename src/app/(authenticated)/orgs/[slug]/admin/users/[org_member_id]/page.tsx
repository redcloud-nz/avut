/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users/[org_member_id]
 */

import { Metadata } from "next";
import { headers as nextHeaders } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { EditObjectIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { S2_Button } from "@/components/ui/s2-button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    S2_Card,
    S2_CardAction,
    S2_CardContent,
    S2_CardDescription,
    S2_CardHeader,
    S2_CardTitle,
} from "@/components/ui/s2-card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import { S2_Value } from "@/components/ui/s2-value";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { formatDate } from "@/lib/datetime";
import { OrganizationMemberData } from "@/lib/schemas/organization-member";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { UserData } from "@/lib/schemas/user";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import prisma from "@/server/prisma";

import { AdminModule_UserMenu } from "./user-menu";
import { auth } from "@/server/auth";

const fetchOrganizationMember = cache(
    async (
        organizationId: string,
        org_member_id: string,
    ): Promise<(OrganizationMemberData & { user: UserData }) | null> => {
        const data = await prisma.organizationMember.findUnique({
            where: {
                id: org_member_id,
                organizationId: organizationId,
            },
            include: { user: true },
        });

        if (!data) return null;

        return {
            ...OrganizationMemberData.fromRecord(data),
            user: UserData.fromRecord(data.user),
        };
    },
);

export async function getMetadata(
    props: PageProps<`/orgs/[slug]/admin/users/[org_member_id]`>,
): Promise<Metadata> {
    const { slug, org_member_id } = await props.params;

    const organization = await getOrganizationBySlug(slug);
    const organizationMember = await fetchOrganizationMember(
        organization.id,
        org_member_id,
    );
    if (!organizationMember) notFound();

    return {
        title: `${organizationMember.user.name || "User"} ${TITLE_SEPARATOR} Users`,
    };
}

export default async function AdminModule_UserDetail_Page(
    props: PageProps<`/orgs/[slug]/admin/users/[org_member_id]`>,
) {
    const { slug, org_member_id } = await props.params;

    const organization = await getOrganizationBySlug(slug);

    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });
    if (!session) redirect(Paths.auth.signIn().href);

    const organizationMember = await fetchOrganizationMember(
        organization.id,
        org_member_id,
    );
    if (!organizationMember) notFound();

    const user = organizationMember.user;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.users,
                    organizationMember.user.name || "User",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={Paths.org(organization.slug).admin.users}
                            >
                                Users List
                            </Hermes.BackButton>

                            <Protect
                                orgId={organization.id}
                                permissions={{ member: ["update"] }}
                            >
                                <ButtonGroup>
                                    <S2_Button variant="outline" asChild>
                                        <Link
                                            to={
                                                Paths.org(
                                                    organization.slug,
                                                ).admin.user(org_member_id)
                                                    .update
                                            }
                                        >
                                            <EditObjectIcon /> Edit
                                        </Link>
                                    </S2_Button>
                                    <AdminModule_UserMenu
                                        currentUserId={session?.user.id}
                                        organization={organization}
                                        organizationMember={organizationMember}
                                        user={organizationMember.user}
                                    />
                                </ButtonGroup>
                            </Protect>
                        </Hermes.SectionHeader>

                        <S2_Card>
                            <S2_CardHeader>
                                <S2_CardTitle>{user.name}</S2_CardTitle>
                                <S2_CardDescription>
                                    {user.id}
                                </S2_CardDescription>
                                <S2_CardAction>
                                    {user.image && (
                                        <img
                                            src={user.image}
                                            alt={`${user.name}'s profile image`}
                                            className="rounded-full w-12 h-12"
                                        />
                                    )}
                                </S2_CardAction>
                            </S2_CardHeader>
                            <S2_CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Email</FieldLabel>
                                        <S2_Value>
                                            {user.email}
                                            {user.emailVerified ? (
                                                <span className="text-muted-foreground ml-2"></span>
                                            ) : null}
                                        </S2_Value>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Role</FieldLabel>
                                        <S2_Value
                                            value={organizationMember.role
                                                .map(
                                                    (role) =>
                                                        OrganizationRole
                                                            .displayNames[role],
                                                )
                                                .join(", ")}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Joined</FieldLabel>
                                        <S2_Value
                                            value={formatDate(
                                                organizationMember.createdAt,
                                            )}
                                        />
                                    </Field>
                                </FieldGroup>
                            </S2_CardContent>
                        </S2_Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
