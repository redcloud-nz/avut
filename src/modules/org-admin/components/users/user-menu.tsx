/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { CrownIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { RefObject } from "react";

import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { ActionsCard, RecordCardMenu } from "@/components/ui/record-card-actions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { hasOwnerRole } from "@/lib/permissions";
import { PersonData } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { AdminModule_LinkPerson_Dialog } from "@/modules/org-admin/components/person-user-link/link-person";
import { AdminModule_UnlinkPerson_Dialog } from "@/modules/org-admin/components/person-user-link/unlink-person";
import { AdminModule_DeleteUser_Dialog } from "@/modules/org-admin/components/users/delete-user";
import { AdminModule_MakeOwner_Dialog } from "@/modules/org-admin/components/users/make-owner";
import { AdminModule_RemoveOwner_Dialog } from "@/modules/org-admin/components/users/remove-owner";
import { type AuthOrganizationMember } from "@/server/auth";

/** Every `?action=` the user page's dialogs answer to. Edit's dialog owns `update` itself. */
const userActions = parseAsStringLiteral([
    "update",
    "delete",
    "link-person",
    "unlink-person",
    "make-owner",
    "remove-owner",
] as const);

interface AdminModule_UserMenuProps {
    userId: UserId;
    member: AuthOrganizationMember;
    linkedPerson: PersonData | null;
    /** The currently signed-in user's id: you can't delete yourself or remove your own ownership. */
    currentUserId: string | undefined;
    /**
     * Where Link person and Unlink return focus once their button has gone: the User card's
     * pencil, which everyone who can link or unlink (`member: ["update"]`) sees.
     */
    returnFocusRef: RefObject<HTMLButtonElement | null>;
}

/**
 * The User card's ⋮ (the page's primary record card): Make owner or Remove owner, and Delete.
 * Edit is the card's pencil, Link person the action card's button, Unlink the Linked Person
 * card's ⋮.
 *
 * Mounts every dialog on the page, whichever card or button opens it.
 */
export function AdminModule_User_Menu({
    userId,
    member,
    linkedPerson,
    currentUserId,
    returnFocusRef,
}: AdminModule_UserMenuProps) {
    const [action, setAction] = useQueryState("action", userActions);

    const canDelete = useHasPermission({ member: ["delete"] });
    // `owner` is granted and revoked through dedicated mutations (`makeOwner`/`removeOwner`),
    // which need `member: ["owner"]`. Removing a member who holds `owner` also needs it (see
    // `removeOrganizationMember`), so an admin can't remove an owner.
    const canManageOwners = useHasPermission({ member: ["owner"] });
    const canDeleteOwner = useHasPermission({ member: ["delete", "owner"] });

    const isOwner = hasOwnerRole(member.role);
    const isSelf = userId === currentUserId;

    const actions: MenuActionProps[] = [];
    if (canManageOwners && !isOwner) {
        actions.push({
            verb: "make-owner",
            label: "Make owner",
            icon: <CrownIcon />,
            onSelect: () => setAction("make-owner", { history: "push" }),
        });
    }
    // `removeOwner` always refuses self-removal.
    if (canManageOwners && isOwner && !isSelf) {
        actions.push({
            verb: "remove-owner",
            label: "Remove owner",
            icon: <CrownIcon />,
            onSelect: () => setAction("remove-owner", { history: "push" }),
            destructive: true,
        });
    }
    if ((isOwner ? canDeleteOwner : canDelete) && !isSelf) {
        actions.push({
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            destructive: true,
        });
    }

    return (
        <>
            <RecordCardMenu actions={actions} category="Users" primary />

            {/* Delete User dialog */}
            <AdminModule_DeleteUser_Dialog
                organizationUser={member}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            {/* Link Person dialog */}
            <AdminModule_LinkPerson_Dialog
                userId={userId}
                userName={member.user.name}
                returnFocusRef={returnFocusRef}
                open={action === "link-person"}
                onOpenChange={(open) =>
                    setAction(open ? "link-person" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            {/* Unlink Person dialog */}
            {linkedPerson && (
                <AdminModule_UnlinkPerson_Dialog
                    userId={userId}
                    userName={member.user.name}
                    personName={linkedPerson.name}
                    returnFocusRef={returnFocusRef}
                    open={action === "unlink-person"}
                    onOpenChange={(open) =>
                        setAction(open ? "unlink-person" : null, {
                            history: open ? "push" : "replace",
                        })
                    }
                />
            )}

            {/* Make Owner dialog */}
            <AdminModule_MakeOwner_Dialog
                organizationUser={member}
                open={action === "make-owner"}
                onOpenChange={(open) =>
                    setAction(open ? "make-owner" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            {/* Remove Owner dialog */}
            <AdminModule_RemoveOwner_Dialog
                organizationUser={member}
                open={action === "remove-owner"}
                onOpenChange={(open) =>
                    setAction(open ? "remove-owner" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}

/**
 * The bare action card at the top of the user's secondary column: Link person, for a user with
 * no linked person. Renders nothing otherwise. The button only sets `?action=`; the dialog is in
 * {@link AdminModule_User_Menu}.
 */
export function AdminModule_User_ActionsCard({
    linkedPerson,
}: {
    linkedPerson: PersonData | null;
}) {
    const [, setAction] = useQueryState("action", userActions);
    const canUpdateLink = useHasPermission({ member: ["update"], person: ["update"] });

    return (
        <ActionsCard>
            {linkedPerson === null && canUpdateLink ? (
                <Button
                    variant="outline"
                    onClick={() => setAction("link-person", { history: "push" })}
                >
                    <ObjectIcons.Link /> Link person
                </Button>
            ) : null}
        </ActionsCard>
    );
}

/** The Linked Person card's ⋮: Unlink. The dialog is in {@link AdminModule_User_Menu}. */
export function AdminModule_User_LinkedPersonMenu() {
    const [, setAction] = useQueryState("action", userActions);
    const canUpdateLink = useHasPermission({ member: ["update"], person: ["update"] });

    const actions: MenuActionProps[] = [];
    if (canUpdateLink) {
        actions.push({
            verb: "unlink",
            label: "Unlink person",
            icon: <ObjectIcons.Unlink />,
            onSelect: () => setAction("unlink-person", { history: "push" }),
        });
    }

    return <RecordCardMenu actions={actions} category="Users" label="Linked person actions" />;
}
