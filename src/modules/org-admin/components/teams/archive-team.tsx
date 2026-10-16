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

export function AdminModule_ArchiveTeam_Dialog({
    team,
    ...props
}: DialogProps & { team: TeamData }) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.teams.archiveTeam.mutationOptions({
            meta: { effects: teamsEffects.archiveTeam },
            onError(error) {
                console.error("Failed to archive team:", error);
                toast.error(`Failed to archive team: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Team <ObjectName>{team.name}</ObjectName> archived.
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
                    <DialogTitle>Archive Team</DialogTitle>
                    <DialogDescription>
                        Archive <ObjectName>{team.name}</ObjectName>. Its members and history are
                        kept, but it drops out of the default Active teams filter, can&apos;t accept
                        new members, and stops syncing with D4H. You can restore it later.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Archive",
                            pending: "Archiving",
                            success: "Archived",
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
