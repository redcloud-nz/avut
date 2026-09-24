/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonData } from "@/lib/schemas/person";

import { AdminModule_ArchivePerson_Dialog } from "./archive-person";
import { AdminModule_DeletePerson_Dialog } from "./delete-person";
import { AdminModule_InvitePerson_Dialog } from "./invite-person";
import { AdminModule_RestorePerson_Dialog } from "./restore-person";

interface AdminModule_PersonMenuProps {
    person: PersonData;
    /** Whether a user account is already attached — hides the invite action when it is. */
    linked: boolean;
}

export function AdminModule_PersonMenu({ person, linked }: AdminModule_PersonMenuProps) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update", "delete", "invite", "archive", "restore"] as const),
    );

    const canUpdate = useHasPermission({ person: ["update"] });
    const canDelete = useHasPermission({ person: ["delete"] });
    const canInvite = useHasPermission({ invitation: ["create"] });

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
            onSelect: () => setAction("archive", { history: "push" }),
            disabled: !canUpdate,
        });
    } else {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: () => setAction("restore", { history: "push" }),
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

    return (
        <>
            <EntityActionMenu
                actions={actions}
                category="Personnel"
                before={
                    <>
                        <DropdownMenuGroup>
                            <DropdownMenuItem disabled asChild>
                                <Link
                                    href={route(
                                        "/orgs/[slug]/admin/personnel/[person_id]/history",
                                        {
                                            slug: organization.slug,
                                            person_id: person.id,
                                        },
                                    )}
                                >
                                    <ObjectIcons.History /> History
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                    </>
                }
            />

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

            {/* Archive Person dialog */}
            <AdminModule_ArchivePerson_Dialog
                person={person}
                open={action === "archive"}
                onOpenChange={(open) =>
                    setAction(open ? "archive" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            {/* Restore Person dialog */}
            <AdminModule_RestorePerson_Dialog
                person={person}
                open={action === "restore"}
                onOpenChange={(open) =>
                    setAction(open ? "restore" : null, {
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
