/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { teamsEffects } from "@/client/teams-effects";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_RestoreTeam_Dialog({
    team,
    ...props
}: DialogProps & { team: TeamData }) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.teams.restoreTeam.mutationOptions({
            meta: { effects: teamsEffects.restoreTeam },
            onError(error) {
                console.error("Failed to restore team:", error);
                toast.error(`Failed to restore team: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Team <ObjectName>{team.name}</ObjectName> restored.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) {
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Restore Team</DialogTitle>
                    <DialogDescription>
                        Restore <ObjectName>{team.name}</ObjectName> to Active status.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Restore",
                            pending: "Restoring",
                            success: "Restored",
                        }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                teamId: team.id,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
