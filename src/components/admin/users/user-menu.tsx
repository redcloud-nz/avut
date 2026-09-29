/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { CrownIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { AdminModule_LinkPerson_Dialog } from "@/components/admin/person-user-link/link-person";
import { AdminModule_UnlinkPerson_Dialog } from "@/components/admin/person-user-link/unlink-person";
import { AdminModule_DeleteUser_Dialog } from "@/components/admin/users/delete-user";
import { AdminModule_MakeOwner_Dialog } from "@/components/admin/users/make-owner";
import { AdminModule_RemoveOwner_Dialog } from "@/components/admin/users/remove-owner";
import { ObjectIcons } from "@/components/icons";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { hasOwnerRole } from "@/lib/permissions";
import { PersonData } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { type AuthOrganizationMember } from "@/server/auth";

interface AdminModule_UserMenuProps {
    userId: UserId;
    member: AuthOrganizationMember;
    linkedPerson: PersonData | null;
    /** The currently signed-in user's id, so Delete can be disabled for a self-delete. */
    currentUserId: string | undefined;
}

export function AdminModule_User_Menu({
    userId,
    member,
    linkedPerson,
    currentUserId,
}: AdminModule_UserMenuProps) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral([
            "update",
            "delete",
            "link-person",
            "unlink-person",
            "make-owner",
            "remove-owner",
        ] as const),
    );

    const canUpdateMember = useHasPermission({ member: ["update"] });
    const canUpdateLink = useHasPermission({ member: ["update"], person: ["update"] });
    const canDelete = useHasPermission({ member: ["delete"] });
    // Removing a member who holds `owner` also needs `member: ["owner"]` (see
    // `removeOrganizationMember`), so an admin can't remove an owner.
    const canDeleteOwner = useHasPermission({ member: ["delete", "owner"] });

    // `owner` is granted/revoked through dedicated mutations, not the general role picker — the
    // menu items below always show (the permission check surfaces as the mutation's own error
    // inside the dialog), but which one shows follows the member's current ownership. Remove is
    // disabled on your own row, since `removeOwner` always refuses self-removal.
    const isOwner = hasOwnerRole(member.role);

    const actions: MenuActionProps[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => setAction("update", { history: "push" }),
            disabled: !canUpdateMember,
        },
    ];
    if (linkedPerson) {
        actions.push({
            verb: "unlink",
            label: "Unlink",
            icon: <ObjectIcons.Unlink />,
            onSelect: () => setAction("unlink-person", { history: "push" }),
            disabled: !canUpdateLink,
        });
    } else {
        actions.push({
            verb: "link",
            label: "Link person",
            icon: <ObjectIcons.Link />,
            onSelect: () => setAction("link-person", { history: "push" }),
            disabled: !canUpdateLink,
        });
    }
    if (isOwner) {
        actions.push({
            verb: "remove-owner",
            label: "Remove owner",
            icon: <CrownIcon />,
            onSelect: () => setAction("remove-owner", { history: "push" }),
            destructive: true,
            disabled: userId === currentUserId,
        });
    } else {
        actions.push({
            verb: "make-owner",
            label: "Make owner",
            icon: <CrownIcon />,
            onSelect: () => setAction("make-owner", { history: "push" }),
        });
    }
    actions.push({
        verb: "delete",
        label: "Delete",
        icon: <ObjectIcons.Delete />,
        onSelect: () => setAction("delete", { history: "push" }),
        disabled: !(isOwner ? canDeleteOwner : canDelete) || userId === currentUserId,
        destructive: true,
    });

    return (
        <>
            <EntityActionMenu actions={actions} category="Users" />

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
