/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { I3Bundle } from "@/lib/schemas/i3-bundle";

import { D4HI3Module_DeleteBundle_Dialog } from "./delete-bundle";
import { D4HI3Module_RecoverBundle_Dialog } from "./recover-bundle";

const ACTIONS = ["update", "delete", "recover"] as const;

/**
 * The bundle page's Actions menu. Edit opens the `?action=update` dialog that the Bundle record
 * card's header hosts, so it only works while the bundle isn't deleted (the card hides the dialog
 * then).
 */
export function D4HI3Module_Bundle_Menu({ bundle }: { bundle: I3Bundle }) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));

    const canUpdate = useHasPermission({ i3Bundle: ["update"] });
    const canDelete = useHasPermission({ i3Bundle: ["delete"] });
    const deleted = bundle.status === "Deleted";

    const actions: MenuActionProps[] = [];
    if (deleted) {
        actions.push({
            verb: "recover",
            label: "Recover from rubbish",
            icon: <ObjectIcons.Recover />,
            onSelect: () => void setAction("recover", { history: "push" }),
            disabled: !canDelete,
        });
    } else {
        actions.push(
            {
                verb: "update",
                label: "Edit",
                icon: <ObjectIcons.Edit />,
                onSelect: () => void setAction("update", { history: "push" }),
                disabled: !canUpdate,
            },
            {
                verb: "delete",
                label: "Delete",
                icon: <ObjectIcons.Delete />,
                onSelect: () => void setAction("delete", { history: "push" }),
                disabled: !canDelete,
                destructive: true,
            },
        );
    }

    return (
        <>
            <EntityActionMenu actions={actions} category="Bundles" />

            <D4HI3Module_DeleteBundle_Dialog
                bundle={bundle}
                open={action === "delete"}
                onOpenChange={(open) =>
                    void setAction(open ? "delete" : null, { history: open ? "push" : "replace" })
                }
            />

            <D4HI3Module_RecoverBundle_Dialog
                bundle={bundle}
                open={action === "recover"}
                onOpenChange={(open) =>
                    void setAction(open ? "recover" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
