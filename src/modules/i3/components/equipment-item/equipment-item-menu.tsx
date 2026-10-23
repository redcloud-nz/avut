/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ExternalLinkIcon, PackageCheckIcon } from "lucide-react";
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

import { updateEquipmentItemDisabledReason } from "./update-equipment-item";

/**
 * The item page's Actions menu: Edit (`?action=update`), Return (`?action=return`) and Open in D4H.
 *
 * A disabled item shows why under its label, since a disabled menu item takes no hover for a
 * tooltip.
 */
export function I3Module_EquipmentItem_Menu({
    d4hUrl,
    teamTitle,
    canUpdateInD4H,
    hasMemberHolder,
    isReturned,
}: {
    /** D4H's view page for the item. */
    d4hUrl: string;
    teamTitle: string;
    /** The viewer's D4H account has Equipment UPDATE on the item's team. */
    canUpdateInD4H: boolean;
    /** The item is issued to a D4H member, so there's someone to return it from. */
    hasMemberHolder: boolean;
    /** The item already has an open retire task. */
    isReturned: boolean;
}) {
    const [, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update", "return"] as const),
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Actions">
                    <DropdownMenuTriggerIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <Protect
                    permissions={{ i3Item: ["update"] }}
                    render={(hasPermission) => {
                        const disabledReason = updateEquipmentItemDisabledReason({
                            hasPermission,
                            canUpdateInD4H,
                            teamTitle,
                        });
                        return (
                            <DropdownMenuItem
                                disabled={disabledReason !== null}
                                onClick={() => setAction("update", { history: "push" })}
                            >
                                <ObjectIcons.Edit />
                                <MenuItemText label="Edit" disabledReason={disabledReason} />
                            </DropdownMenuItem>
                        );
                    }}
                />
                <Protect
                    permissions={{ i3Item: ["return"] }}
                    render={(hasPermission) => {
                        const disabledReason = !hasPermission
                            ? "Returning items needs the I3 Editor or I3 Admin role."
                            : !canUpdateInD4H
                              ? `Your D4H account doesn't have the Equipment Update permission on ${teamTitle}.`
                              : isReturned
                                ? "This item has already been returned."
                                : !hasMemberHolder
                                  ? "This item isn't issued to a person."
                                  : null;
                        return (
                            <DropdownMenuItem
                                disabled={disabledReason !== null}
                                onClick={() => setAction("return", { history: "push" })}
                            >
                                <PackageCheckIcon />
                                <MenuItemText label="Return" disabledReason={disabledReason} />
                            </DropdownMenuItem>
                        );
                    }}
                />
                <DropdownMenuItem asChild>
                    <a href={d4hUrl} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon />
                        Open in D4H
                    </a>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function MenuItemText({ label, disabledReason }: { label: string; disabledReason: string | null }) {
    if (disabledReason === null) return label;

    return (
        <span className="flex flex-col">
            {label}
            <span className="max-w-56 text-xs text-muted-foreground">{disabledReason}</span>
        </span>
    );
}
