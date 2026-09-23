/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { personnelEffects } from "@/client/personnel-effects";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MenuAction,
    useMenuActionHotkeys,
    type MenuActionProps,
} from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

import { AdminModule_DeletePerson_Dialog } from "./delete-person";
import { AdminModule_InvitePerson_Dialog } from "./invite-person";

interface AdminModule_PersonMenuProps {
    person: PersonData;
    /** Whether a user account is already attached — hides the invite action when it is. */
    linked: boolean;
}

export function AdminModule_PersonMenu({ person, linked }: AdminModule_PersonMenuProps) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update", "delete", "invite"] as const),
    );

    const canUpdate = useHasPermission({ person: ["update"] });
    const canDelete = useHasPermission({ person: ["delete"] });
    const canInvite = useHasPermission({ invitation: ["create"] });

    const archiveMutation = useMutation(
        trpc.personnel.archivePerson.mutationOptions({
            meta: { effects: personnelEffects.archivePerson },
            onError(error) {
                toast.error(`Failed to archive person: ${error.message}`);
                console.error("Failed to archive person:", error);
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.personnel.restorePerson.mutationOptions({
            meta: { effects: personnelEffects.restorePerson },
            onError(error) {
                toast.error(`Failed to restore person: ${error.message}`);
                console.error("Failed to restore person:", error);
            },
        }),
    );

    function handleArchive() {
        toast.promise(
            archiveMutation.mutateAsync({ organizationId: organization.id, personId: person.id }),
            {
                loading: "Archiving person record...",
                success: "Person record archived.",
                error: (error) => "Failed to archive person record: " + error.message,
            },
        );
    }

    function handleRestore() {
        toast.promise(
            restoreMutation.mutateAsync({ organizationId: organization.id, personId: person.id }),
            {
                loading: "Restoring person record...",
                success: "Person record restored.",
                error: (error) => "Failed to restore person record: " + error.message,
            },
        );
    }

    const actions: MenuActionProps[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => setAction("update", { history: "push" }),
            disabled: !canUpdate,
        },
    ];
    if (person.status === "Active" && !linked) {
        actions.push({
            verb: "invite",
            label: "Invite to AVUT",
            icon: <ObjectIcons.Invite />,
            onSelect: () => setAction("invite", { history: "push" }),
            disabled: !canInvite,
        });
    }
    if (person.status === "Active") {
        actions.push({
            verb: "archive",
            label: "Archive",
            icon: <ObjectIcons.Archive />,
            onSelect: handleArchive,
            disabled: !canUpdate,
        });
    } else {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: handleRestore,
            disabled: !canUpdate,
        });
    }
    if (person.status !== "Deleted") {
        actions.push({
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            disabled: !canDelete,
            destructive: true,
        });
    }

    useMenuActionHotkeys(actions, "Personnel");

    return (
        <>
            {/* Person dropdown menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-50" align="end">
                    <DropdownMenuGroup>
                        <DropdownMenuItem disabled asChild>
                            <Link
                                href={route("/orgs/[slug]/admin/personnel/[person_id]/history", {
                                    slug: organization.slug,
                                    person_id: person.id,
                                })}
                            >
                                <ObjectIcons.History /> History
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />

                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {actions.map((a) => (
                            <MenuAction key={a.verb} {...a} />
                        ))}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Invite Person dialog */}
            <AdminModule_InvitePerson_Dialog
                person={person}
                open={action === "invite"}
                onOpenChange={(open) =>
                    setAction(open ? "invite" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            {/* Delete Person dialog*/}
            <AdminModule_DeletePerson_Dialog
                person={person}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
