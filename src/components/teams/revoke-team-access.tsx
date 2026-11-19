/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, RefObject, useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { teamUsersEffects } from "@/client/team-users-effects";
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
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { TeamData } from "@/lib/schemas/team";
import { TeamUserData } from "@/lib/schemas/team-user";
import { trpc } from "@/trpc/client";

type RevokeTeamAccessProps = ComponentProps<typeof AlertDialog> & {
    team: TeamData;
    grant: TeamUserData;
    /** Where focus goes on close, since the revoked row's button is gone by then. */
    returnFocusRef?: RefObject<HTMLElement | null>;
    /** The grant is the signed-in user's own: the dialog warns they'll lose access. */
    isSelf?: boolean;
    /** Called after a successful revoke in place of closing the dialog — e.g. to navigate away. */
    onRevoked?: () => void;
};

/**
 * Revokes a user's access to a team (`?action=revoke-access&userId=…`). Host-driven: the Access
 * card owns both params and resolves `grant` from its list.
 */
export function Teams_RevokeTeamAccess_Dialog({
    team,
    grant,
    returnFocusRef,
    isSelf = false,
    onRevoked,
    ...props
}: RevokeTeamAccessProps) {
    const organization = useOrganization();
    const returnFocus = useReturnFocus(returnFocusRef);

    const mutation = useMutation(
        trpc.teamUsers.revokeTeamAccess.mutationOptions({
            meta: { effects: teamUsersEffects.revokeTeamAccess },
            onError(error) {
                console.error("Failed to revoke team access:", error);
                toast.error(`Failed to revoke team access: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Revoked <ObjectName>{grant.user.name}</ObjectName>&apos;s access to{" "}
                        <ObjectName>{team.name}</ObjectName>.
                    </>,
                );
                if (onRevoked) onRevoked();
                else props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) {
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition (or a row change) only
    }, [props.open, grant.userId]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent {...returnFocus}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Revoke Access</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm removing <ObjectName>{grant.user.name}</ObjectName>&apos;s access to{" "}
                        <ObjectName>{team.name}</ObjectName>.
                        {isSelf && <> You&apos;ll lose access to this team&apos;s space.</>}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Revoke", pending: "Revoking", success: "Revoked" }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                teamId: team.id,
                                userId: grant.userId,
                            })
                        }
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
