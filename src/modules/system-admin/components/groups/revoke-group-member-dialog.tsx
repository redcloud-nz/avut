/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, RefObject, useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { organizationGroupsEffects } from "@/client/organization-groups-effects";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ObjectName } from "@/components/ui/typography";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { OrganizationGroupMembershipId } from "@/lib/schemas/organization-group";
import { trpc } from "@/trpc/client";

/**
 * `?action=revoke-member&membershipId=…` confirm for revoking an organization's membership of a
 * group. A state-transition confirm (plain `Dialog`): the membership row stays, and re-adding the
 * organization reactivates it. Props-driven; `SystemAdmin_GroupMemberActionsMenu` owns both
 * params.
 *
 * Opened from a `DropdownMenuItem`, so there is no `DialogTrigger` to return focus to: pass
 * `returnFocusRef` (the row's menu button) for when the opener has gone.
 */
export function SystemAdmin_RevokeGroupMember_Dialog({
    membership,
    groupName,
    returnFocusRef,
    ...props
}: ComponentProps<typeof Dialog> & {
    membership: { id: OrganizationGroupMembershipId; organization: { name: string } };
    groupName: string;
    returnFocusRef?: RefObject<HTMLElement | null>;
}) {
    const returnFocus = useReturnFocus(returnFocusRef);

    const mutation = useMutation(
        trpc.organizationGroups.revokeMember.mutationOptions({
            meta: { effects: organizationGroupsEffects.revokeMember },
            onError(error) {
                console.error("Failed to revoke membership:", error);
                toast.error(`Failed to revoke membership: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        <ObjectName>{membership.organization.name}</ObjectName> revoked from the
                        group.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition (or a row swap) only
    }, [props.open, membership.id]);

    return (
        <Dialog {...props}>
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Revoke Membership</DialogTitle>
                    <DialogDescription>
                        Revoke <ObjectName>{membership.organization.name}</ObjectName>&rsquo;s
                        membership of <ObjectName>{groupName}</ObjectName>. Its membership history
                        is kept, and it can be added back later.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Revoke", pending: "Revoking", success: "Revoked" }}
                        onClick={() => mutation.mutate({ membershipId: membership.id })}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
