/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { RecordCardMenu } from "@/components/ui/record-card-actions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { I3Bundle } from "@/lib/schemas/i3-bundle";

import { D4HI3Module_DeleteBundle_Dialog } from "./delete-bundle";
import { D4HI3Module_RecoverBundle_Dialog } from "./recover-bundle";

const ACTIONS = ["delete", "recover"] as const;

/**
 * The I3 Bundle card's ⋮ (the page's primary record card): Delete, or Recover once it's in the
 * Rubbish bin. Edit is the card's pencil.
 *
 * Mounts the delete and recover dialogs; the Rubbish-bin banner's Recover opens the same one.
 */
export function D4HI3Module_Bundle_Menu({ bundle }: { bundle: I3Bundle }) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));

    const canDelete = useHasPermission({ i3Bundle: ["delete"] });
    const deleted = bundle.status === "Deleted";

    const actions: MenuActionProps[] = [];
    if (deleted && canDelete) {
        actions.push({
            verb: "recover",
            label: "Recover from rubbish",
            icon: <ObjectIcons.Recover />,
            onSelect: () => void setAction("recover", { history: "push" }),
        });
    }
    if (!deleted && canDelete) {
        actions.push({
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => void setAction("delete", { history: "push" }),
            destructive: true,
        });
    }

    return (
        <>
            <RecordCardMenu actions={actions} category="Bundles" primary />

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
