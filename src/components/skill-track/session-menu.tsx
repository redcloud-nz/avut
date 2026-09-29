/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { LockOpenIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MenuAction,
    useMenuActionHotkeys,
    type MenuActionProps,
} from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";

import { SkillsModule_DeleteSession_Dialog } from "./delete-session";
import { SkillsModule_ReopenSession_Dialog } from "./reopen-session";

export function SkillsModule_SessionMenu({ session }: { session: SkillCheckSession }) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["reopen", "delete"] as const),
    );

    const canReopen = useHasPermission({ skillCheckSession: ["approve"] });
    const canDelete = useHasPermission({ skillCheckSession: ["delete"] });

    // Reopen only exists for an approved session; a Draft one has nothing to reopen.
    const isApproved = session.status === "Include";

    const actions: MenuActionProps[] = [
        ...(isApproved
            ? [
                  {
                      verb: "reopen",
                      label: "Reopen",
                      icon: <LockOpenIcon />,
                      onSelect: () => setAction("reopen", { history: "push" }),
                      disabled: !canReopen,
                  } satisfies MenuActionProps,
              ]
            : []),
        {
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            disabled: !canDelete,
            destructive: true,
        },
    ];

    useMenuActionHotkeys(actions, "Sessions");

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    {actions.map((a) => (
                        <MenuAction key={a.verb} {...a} />
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <SkillsModule_ReopenSession_Dialog
                session={session}
                open={isApproved && action === "reopen"}
                onOpenChange={(open) =>
                    setAction(open ? "reopen" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillsModule_DeleteSession_Dialog
                session={session}
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
