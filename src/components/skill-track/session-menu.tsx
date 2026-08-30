/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useRef } from "react";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SkillCheckSession } from "@/lib/schemas/skill-check-session";

import { SkillsModule_DeleteSession_Dialog } from "./delete-session";

export function SkillsModule_SessionMenu({ session }: { session: SkillCheckSession }) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["delete"] as const));

    const menuTriggerRef = useRef<HTMLButtonElement>(null);

    return (
        <>
            <DropdownMenu
                onOpenChange={(open) => {
                    if (!open) menuTriggerRef.current?.focus();
                }}
            >
                <DropdownMenuTrigger asChild>
                    <Button ref={menuTriggerRef} variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <Protect
                        permissions={{ skillCheckSession: ["delete"] }}
                        render={(allowed) => (
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setAction("delete", { history: "push" })}
                                disabled={!allowed}
                            >
                                <ObjectIcons.Delete /> Delete
                            </DropdownMenuItem>
                        )}
                    />
                </DropdownMenuContent>
            </DropdownMenu>

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
