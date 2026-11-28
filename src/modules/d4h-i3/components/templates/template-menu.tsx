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
import { I3Template } from "@/lib/schemas/i3-template";

import { D4HI3Module_DeleteTemplate_Dialog } from "./delete-template";
import { D4HI3Module_RecoverTemplate_Dialog } from "./recover-template";

/**
 * The I3 Template card's ⋮ (the page's primary record card): Delete, or Recover once it's in the
 * Rubbish bin. Edit is the card's pencil.
 *
 * Mounts the dialogs they open.
 */
export function D4HI3Module_Template_Menu({ template }: { template: I3Template }) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "recover"] as const),
    );

    const canDelete = useHasPermission({ i3Template: ["delete"] });
    const deleted = template.status === "Deleted";

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
            <RecordCardMenu actions={actions} category="Templates" primary />

            <D4HI3Module_DeleteTemplate_Dialog
                template={template}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            <D4HI3Module_RecoverTemplate_Dialog
                template={template}
                open={action === "recover"}
                onOpenChange={(open) =>
                    setAction(open ? "recover" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
