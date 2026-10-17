/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useRef } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { organizationGroupsEffects } from "@/client/organization-groups-effects";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ObjectName } from "@/components/ui/typography";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    OrganizationGroupId,
    OrganizationGroupMembershipId,
    OrganizationGroupMembershipStatus,
    OrganizationGroupRole,
} from "@/lib/schemas/organization-group";
import { trpc } from "@/trpc/client";

import { SystemAdmin_RevokeGroupMember_Dialog } from "./revoke-group-member-dialog";

interface Membership {
    id: OrganizationGroupMembershipId;
    role: OrganizationGroupRole;
    status: OrganizationGroupMembershipStatus;
    organization: { id: OrganizationId; name: string };
}

/**
 * Per-row actions for a group membership on the system-admin group detail page. An active row
 * offers "Make overseer" / "Make member" (whichever applies) and "Revoke"
 * (`?action=revoke-member&membershipId=…`, owned here); a revoked row offers "Re-add", which adds
 * the organization back as a member (promote it afterwards if needed). The dormant `Invited`
 * status gets no actions.
 */
export function SystemAdmin_GroupMemberActionsMenu({
    group,
    membership,
}: {
    group: { id: OrganizationGroupId; name: string };
    membership: Membership;
}) {
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["revoke-member"] as const),
    );
    const [membershipId, setMembershipId] = useQueryState("membershipId", parseAsString);
    // Only an active row can be revoked, so a pasted or restored URL naming a revoked row stays shut.
    const revokeDialogOpen =
        action === "revoke-member" &&
        membershipId === membership.id &&
        membership.status === "Active";

    function openRevoke() {
        void setMembershipId(membership.id, { history: "push" });
        void setAction("revoke-member", { history: "push" });
    }
    function closeRevoke() {
        void setAction(null, { history: "replace" });
        void setMembershipId(null, { history: "replace" });
    }

    const organizationName = membership.organization.name;

    const setRoleMutation = useMutation(
        trpc.organizationGroups.setMemberRole.mutationOptions({
            meta: { effects: organizationGroupsEffects.setMemberRole },
            onError(error) {
                console.error("Failed to change role:", error);
                // An overseer conflict carries the service's message ("… already has an overseer").
                toast.error(
                    error.data?.code === "CONFLICT"
                        ? error.message
                        : `Failed to change role: ${error.message}`,
                );
            },
            onSuccess(_data, { role }) {
                toast.success(
                    <>
                        <ObjectName>{organizationName}</ObjectName> is now{" "}
                        {role === "Overseer" ? "the overseer" : "a member"}.
                    </>,
                );
            },
        }),
    );

    const readdMutation = useMutation(
        trpc.organizationGroups.addMember.mutationOptions({
            meta: { effects: organizationGroupsEffects.addMember },
            onError(error) {
                console.error("Failed to re-add organisation:", error);
                toast.error(`Failed to re-add organisation: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        <ObjectName>{organizationName}</ObjectName> re-added as a member.
                    </>,
                );
            },
        }),
    );

    if (membership.status === "Invited") return null;

    const pending = setRoleMutation.isPending || readdMutation.isPending;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        ref={menuButtonRef}
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${organizationName}`}
                    >
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-44" align="end">
                    {membership.status === "Active" ? (
                        <>
                            <DropdownMenuItem
                                disabled={pending}
                                onSelect={() =>
                                    setRoleMutation.mutate({
                                        membershipId: membership.id,
                                        role:
                                            membership.role === "Overseer" ? "Member" : "Overseer",
                                    })
                                }
                            >
                                <ObjectIcons.Edit />
                                {membership.role === "Overseer" ? "Make member" : "Make overseer"}
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={openRevoke}>
                                <ObjectIcons.Unlink /> Revoke
                            </DropdownMenuItem>
                        </>
                    ) : (
                        <DropdownMenuItem
                            disabled={pending}
                            onSelect={() =>
                                readdMutation.mutate({
                                    groupId: group.id,
                                    organizationId: membership.organization.id,
                                    role: "Member",
                                })
                            }
                        >
                            <ObjectIcons.Link /> Re-add
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <SystemAdmin_RevokeGroupMember_Dialog
                membership={membership}
                groupName={group.name}
                returnFocusRef={menuButtonRef}
                open={revokeDialogOpen}
                onOpenChange={(open) => (open ? undefined : closeRevoke())}
            />
        </>
    );
}
