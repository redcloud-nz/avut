/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/--select
 */

import {
    Building2Icon,
    ChevronRightIcon,
    PlusIcon,
    SendIcon,
    UserIcon,
} from "lucide-react";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { Argus } from "@/components/blocks/argus";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/items";
import { Link } from "@/components/ui/link";

import * as Paths from "@/paths";
import { auth } from "@/server/auth";
import prisma from "@/server/prisma";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { Separator } from "@/components/ui/separator";
import { Show } from "@/components/show";

export const metadata = { title: "Select Organization" };

export default async function OrganizationSelect_Page(
    props: PageProps<"/orgs/--select">,
) {
    const headers = await nextHeaders();
    const searchParams = await props.searchParams;

    const session = await auth.api.getSession({ headers });
    if (!session) redirect(Paths.auth.signIn().href);

    const [memberships, invitations] = await Promise.all([
        await prisma.organizationUser.findMany({
            where: {
                userId: session.user.id,
            },
            include: {
                organization: true,
            },
        }),
        await prisma.organizationInvitation.findMany({
            where: {
                email: session.user.email,
                status: "pending",
            },
            include: {
                organization: {
                    select: {
                        name: true,
                    },
                },
            },
        }),
    ]);

    const pendingInvitations = invitations.filter(
        (invitation) => invitation.status === "pending",
    );

    if (
        "auto" in searchParams &&
        memberships.length === 1 &&
        pendingInvitations.length === 0
    ) {
        redirect(Paths.org(memberships[0].organization.slug).dashboard.href);
    }

    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />

                <Card>
                    <CardHeader>
                        <CardTitle>Select account to use</CardTitle>
                        <CardDescription>
                            Signed in as <br />
                            {session.user.name} ({session.user.email}).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Item asChild>
                            <Link to={Paths.personal.dashboard}>
                                <ItemMedia>
                                    <UserIcon className="size-5" />
                                </ItemMedia>
                                <ItemContent>
                                    <ItemTitle>Personal Account</ItemTitle>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>

                        <Show when={memberships.length > 0}>
                            <Separator />

                            {memberships.map((membership) => (
                                <Item key={membership.organization.id} asChild>
                                    <Link
                                        to={
                                            Paths.org(
                                                membership.organization.slug,
                                            ).dashboard
                                        }
                                    >
                                        <ItemMedia>
                                            <Building2Icon className="size-5" />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle>
                                                {membership.organization.name}
                                            </ItemTitle>
                                            <ItemDescription>
                                                {membership.role
                                                    .split(",")
                                                    .map(
                                                        (role) =>
                                                            OrganizationRole
                                                                .displayNames[
                                                                role as OrganizationRole
                                                            ],
                                                    )
                                                    .join(", ")}
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                            ))}
                        </Show>
                        <Show when={pendingInvitations.length > 0}>
                            <Separator />

                            {pendingInvitations.map((invitation) => (
                                <Item key={invitation.id} asChild>
                                    <Link
                                        to={Paths.personal.invitation(
                                            invitation.id,
                                        )}
                                    >
                                        <ItemMedia>
                                            <SendIcon className="size-5" />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle>
                                                {invitation.organization.name}
                                            </ItemTitle>
                                            <ItemDescription>
                                                Invitation
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                            ))}
                        </Show>

                        <Separator />
                        <Item asChild>
                            <Link to={Paths.orgs.create}>
                                <ItemContent>
                                    <ItemTitle>New Organization</ItemTitle>
                                </ItemContent>
                                <ItemActions>
                                    <PlusIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                    </CardContent>
                </Card>
            </Argus.Column>
        </Argus.Root>
    );
}
