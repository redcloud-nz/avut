/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { Button, MutationButton } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ObjectName } from "@/components/ui/typography";

import { InvitationSignUp_Form } from "./invitation-sign-up";

import { useSignOut } from "@/client/use-sign-out";
import { usersEffects } from "@/client/users-effects";
import { useLogger } from "@/hooks/use-logger";
import { authUrl, SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/auth-redirect";
import { route } from "@/lib/routes";
import type { InvitationId } from "@/lib/schemas/organization-invitation";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type Landing = Exclude<RouterOutput["invitations"]["getLanding"], { state: "not-found" }>;

/**
 * The page an invitation email links to. Renders whichever screen fits the invitation's state
 * and whoever is looking at it — see `InvitationLandingData`.
 *
 * @param invitationId The invitation from the link.
 */
export function InvitationLanding_Card({ invitationId }: { invitationId: InvitationId }) {
    const { data: landing } = useSuspenseQuery(
        trpc.invitations.getLanding.queryOptions({ invitationId }),
    );

    if (landing.state === "not-found")
        return (
            <Message
                title="Invitation not found"
                description="This link doesn't match an invitation. Check that you copied the whole link, or ask the organisation to send you a new one."
            />
        );

    const { organization, viewer } = landing;
    const orgName = <ObjectName>{organization.name}</ObjectName>;

    switch (landing.state) {
        case "pending":
            return <Pending_Card invitationId={invitationId} landing={landing} />;
        case "expired":
            return (
                <Message
                    title="This invitation has expired"
                    description={<>Ask {orgName} to send you a new invitation.</>}
                />
            );
        case "accepted":
            return viewer.kind === "recipient" ? (
                <Message
                    title={<>You&apos;ve joined {orgName}</>}
                    description="This invitation has already been accepted."
                    footer={
                        <Button asChild>
                            <Link href={route("/orgs/[slug]", { slug: organization.slug })}>
                                Open {organization.name}
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <Message
                    title="This invitation has already been accepted"
                    description={<>It can&apos;t be used again. Ask {orgName} for a new one.</>}
                />
            );
        case "rejected":
            return (
                <Message
                    title="This invitation was declined"
                    description={
                        <>Ask {orgName} to send you a new invitation if that was a mistake.</>
                    }
                />
            );
        case "canceled":
            return (
                <Message
                    title="This invitation is no longer valid"
                    description={<>{orgName} withdrew it or replaced it with a newer one.</>}
                />
            );
    }
}

function Message({
    title,
    description,
    footer,
}: {
    title: ReactNode;
    description: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            {footer && <CardFooter className="gap-2">{footer}</CardFooter>}
        </Card>
    );
}

function Pending_Card({ invitationId, landing }: { invitationId: InvitationId; landing: Landing }) {
    const { organization, inviterName, email, personName, hasAccount, viewer } = landing;
    const returnTo = `/invitations/${invitationId}`;
    const signingUp = viewer.kind === "anonymous" && !hasAccount;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Join {organization.name}</CardTitle>
                <CardDescription>
                    {inviterName} invited you to join <ObjectName>{organization.name}</ObjectName>{" "}
                    on AVUT.
                </CardDescription>
            </CardHeader>
            {signingUp ? (
                <CardContent>
                    <InvitationSignUp_Form
                        invitationId={invitationId}
                        email={email}
                        name={personName}
                    />
                </CardContent>
            ) : viewer.kind === "other" ? (
                <CardContent className="text-sm text-muted-foreground">
                    This invitation is for <span className="text-foreground">{email}</span>, but
                    you&apos;re signed in as <span className="text-foreground">{viewer.email}</span>
                    .
                </CardContent>
            ) : (
                <CardContent className="text-sm text-muted-foreground">
                    Invitation for <span className="text-foreground">{email}</span>
                </CardContent>
            )}
            <CardFooter className="flex-wrap gap-2">
                {viewer.kind === "recipient" && (
                    <Respond_Actions invitationId={invitationId} landing={landing} />
                )}
                {viewer.kind === "anonymous" && hasAccount && (
                    <Button asChild>
                        <Link href={authUrl(SIGN_IN_PATH, { email, returnTo })}>
                            Sign in to respond
                        </Link>
                    </Button>
                )}
                {signingUp && (
                    <p className="text-sm text-muted-foreground">
                        Prefer to sign up with a social account?{" "}
                        <Link
                            className="underline underline-offset-4"
                            href={authUrl(SIGN_UP_PATH, { email, name: personName, returnTo })}
                        >
                            Use the standard sign-up
                        </Link>
                        .
                    </p>
                )}
                {viewer.kind === "other" && <SwitchAccount_Button returnTo={returnTo} />}
            </CardFooter>
        </Card>
    );
}

function Respond_Actions({
    invitationId,
    landing,
}: {
    invitationId: InvitationId;
    landing: Landing;
}) {
    const router = useRouter();
    const logger = useLogger("Common", "InvitationLanding");

    const acceptMutation = useMutation(
        trpc.users.acceptInvitation.mutationOptions({
            meta: { effects: usersEffects.acceptInvitation },
            onError(error) {
                logger.error("Failed to accept invitation", error);
                toast.error(`Failed to accept invitation: ${error.message}`);
            },
            onSuccess({ organizationSlug }) {
                toast.success(
                    <>
                        Joined <ObjectName>{landing.organization.name}</ObjectName>
                    </>,
                );
                router.push(route("/orgs/[slug]", { slug: organizationSlug }));
            },
        }),
    );

    const rejectMutation = useMutation(
        trpc.users.rejectInvitation.mutationOptions({
            meta: { effects: usersEffects.rejectInvitation },
            onError(error) {
                logger.error("Failed to reject invitation", error);
                toast.error(`Failed to decline invitation: ${error.message}`);
            },
        }),
    );

    const busy = acceptMutation.isPending || rejectMutation.isPending;
    const input = { invitationId };

    return (
        <>
            <MutationButton
                type="button"
                status={acceptMutation.status}
                disabled={busy}
                text={{ idle: "Accept", pending: "Accepting", success: "Accepted" }}
                onClick={() => acceptMutation.mutate(input)}
            />
            <Button
                type="button"
                variant="outline"
                disabled={busy || acceptMutation.isSuccess}
                onClick={() => rejectMutation.mutate(input)}
            >
                Decline
            </Button>
        </>
    );
}

function SwitchAccount_Button({ returnTo }: { returnTo: string }) {
    const signOut = useSignOut(returnTo);

    return (
        <Button type="button" variant="outline" onClick={() => void signOut()}>
            Sign out and continue
        </Button>
    );
}
