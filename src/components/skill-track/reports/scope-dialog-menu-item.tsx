/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { TelescopeIcon } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

/**
 * Dropdown-menu entry that opens a report's scope dialog by writing `?action=select-scope`
 * — the same param the scope dialogs key off. Rendered `sm:hidden`, it stands in for the
 * standalone "Change scope" trigger button on phone-width screens.
 */
export function SkillTrack_ScopeDialogMenuItem({ label = "Change scope" }: { label?: string }) {
    const [, setAction] = useQueryState("action", parseAsStringLiteral(["select-scope"] as const));

    return (
        <DropdownMenuItem
            className="sm:hidden"
            onSelect={() => void setAction("select-scope", { history: "push" })}
        >
            <TelescopeIcon />
            <span>{label}</span>
        </DropdownMenuItem>
    );
}
