/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

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
import { I3Bundle } from "@/lib/schemas/i3-bundle";

import { D4HI3Module_DeleteBundle_Dialog } from "./delete-bundle";
import { D4HI3Module_RecoverBundle_Dialog } from "./recover-bundle";

export function D4HI3Module_Bundle_Menu({ bundle }: { bundle: I3Bundle }) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "recover"] as const),
    );

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Actions">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <Protect
                        permissions={{ i3Bundle: ["delete"] }}
                        render={(allowed) =>
                            bundle.status === "Deleted" ? (
                                <DropdownMenuItem
                                    onClick={() => setAction("recover", { history: "push" })}
                                    disabled={!allowed}
                                >
                                    <ObjectIcons.Recover /> Recover from rubbish
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onClick={() => setAction("delete", { history: "push" })}
                                    disabled={!allowed}
                                >
                                    <ObjectIcons.Delete /> Delete
                                </DropdownMenuItem>
                            )
                        }
                    />
                </DropdownMenuContent>
            </DropdownMenu>

            <D4HI3Module_DeleteBundle_Dialog
                bundle={bundle}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, { history: open ? "push" : "replace" })
                }
            />

            <D4HI3Module_RecoverBundle_Dialog
                bundle={bundle}
                open={action === "recover"}
                onOpenChange={(open) =>
                    setAction(open ? "recover" : null, { history: open ? "push" : "replace" })
                }
            />
        </>
    );
}
