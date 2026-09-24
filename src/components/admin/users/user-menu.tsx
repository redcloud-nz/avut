/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { AdminModule_LinkPerson_Dialog } from "@/components/admin/person-user-link/link-person";
import { AdminModule_UnlinkPerson_Dialog } from "@/components/admin/person-user-link/unlink-person";
import { AdminModule_DeleteUser_Dialog } from "@/components/admin/users/delete-user";
import { ObjectIcons } from "@/components/icons";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
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
        parseAsStringLiteral(["update", "delete", "link-person", "unlink-person"] as const),
    );

    const canUpdateMember = useHasPermission({ member: ["update"] });
    const canUpdateLink = useHasPermission({ member: ["update"], person: ["update"] });
    const canDelete = useHasPermission({ member: ["delete"] });

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
    actions.push({
        verb: "delete",
        label: "Delete",
        icon: <ObjectIcons.Delete />,
        onSelect: () => setAction("delete", { history: "push" }),
        disabled: !canDelete || userId === currentUserId,
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
        </>
    );
}
