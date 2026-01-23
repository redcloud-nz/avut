/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/accept-invite/[invite-id]
 */

import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import Artie from "@/components/art/artie";
import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Link } from "@/components/ui/link";

import * as Paths from "@/paths";
import { auth } from "@/server/auth";
import prisma from "@/server/prisma";

export default async function Auth_AcceptInvite_Page(
    props: PageProps<"/auth/accept-invite/[invitation-id]">,
) {
    const { "invitation-id": invitationId } = await props.params;

    const headers = await nextHeaders();

    const session = await auth.api.getSession({
        headers,
    });

    if (!session) {
        // Not signed in, redirect to sign-in page with redirect back to this invite
        redirect(
            Paths.auth.signIn({
                redirect: Paths.auth.acceptInvite(invitationId).href,
            }).href,
        );
    }

    try {
        const data = await auth.api.acceptInvitation({
            headers,
            body: { invitationId },
        });

        const organization = await prisma.organization.findUnique({
            where: { id: data!.member.organizationId },
        });

        redirect(Paths.org(organization!.slug).dashboard.href);
    } catch (error) {
        console.error("Error accepting invitation:", error);
        // Invitation acceptance failed
        return (
            <div className="w-full h-screen flex flex-col justify-center md:items-center gap-4">
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia>
                            <Artie pose="Error" />
                        </EmptyMedia>
                        <EmptyTitle>Invalid Invitation</EmptyTitle>
                        <EmptyDescription>
                            The invitation is invalid or has already been
                            accepted.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button variant="outline" asChild>
                            <Link to={{ href: "/" }}>Home Page</Link>
                        </Button>
                    </EmptyContent>
                </Empty>
            </div>
        );
    }
}
