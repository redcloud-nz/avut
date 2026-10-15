/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { ComponentProps, useEffect, useState } from "react";
import { toast } from "sonner";

import { useMutation, useQuery } from "@tanstack/react-query";

import { userEffects } from "@/client/user-effects";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ObjectName } from "@/components/ui/typography";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type Membership = RouterOutput["user"]["listMemberships"][number];

/**
 * Confirm leaving an organisation. Leaving as its only owner is allowed, but leaves it with no
 * owner until a system admin appoints one — so the dialog says so and asks for the
 * organisation's name before it lets you.
 */
export function UserSettings_LeaveOrganization_Dialog({
    membership,
    ...props
}: ComponentProps<typeof AlertDialog> & { membership: Membership }) {
    const router = useRouter();
    const [confirmText, setConfirmText] = useState("");
    const organizationName = membership.organization.name;

    const soleOwned = useQuery({
        ...trpc.user.listSoleOwnedOrganizations.queryOptions(),
        enabled: props.open === true,
    });
    const isSoleOwner = soleOwned.data?.some((o) => o.id === membership.organization.id) ?? false;
    const confirmed = !isSoleOwner || confirmText.trim() === organizationName;

    const mutation = useMutation(
        trpc.user.leaveOrganization.mutationOptions({
            meta: { effects: userEffects.leaveOrganization },
            onError(error) {
                toast.error(`Failed to leave organisation: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Left <ObjectName>{membership.organization.name}</ObjectName>
                    </>,
                );
                router.push("/user/settings/organizations");
            },
        }),
    );

    useEffect(() => {
        if (props.open) {
            setConfirmText("");
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open, membership.organization.id]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Leave Organisation</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm leaving <ObjectName>{membership.organization.name}</ObjectName>.
                        You&rsquo;ll need a new invitation to rejoin.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {isSoleOwner && (
                    <>
                        <Alert variant="warning">
                            <AlertTitle>You&rsquo;re the only owner</AlertTitle>
                            <AlertDescription>
                                <ObjectName>{organizationName}</ObjectName> will have no owner once
                                you leave. Nobody in it will be able to manage its owners until a
                                system administrator appoints a new one.
                            </AlertDescription>
                        </Alert>
                        <Field>
                            <FieldLabel htmlFor="leave-organization-confirm">
                                Type <span className="font-mono">{organizationName}</span> to
                                confirm
                            </FieldLabel>
                            <Input
                                id="leave-organization-confirm"
                                autoComplete="off"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                            />
                        </Field>
                    </>
                )}
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        disabled={soleOwned.isPending || !confirmed}
                        status={mutation.status}
                        text={{ idle: "Leave", pending: "Leaving", success: "Left" }}
                        onClick={() =>
                            mutation.mutate({ organizationId: membership.organization.id })
                        }
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
