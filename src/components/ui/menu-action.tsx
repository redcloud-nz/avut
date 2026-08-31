/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode } from "react";

import { formatForDisplay } from "@tanstack/react-hotkeys";

import { DropdownMenuItem, DropdownMenuShortcut } from "@/components/ui/dropdown-menu";

import { ActionHotkey, ActionVerb } from "@/lib/hotkeys";

interface MenuActionProps {
    /** Action verb — determines the shortcut badge via the {@link ActionHotkey} registry. */
    verb: ActionVerb;
    label: string;
    icon: ReactNode;
    onSelect: () => void;
    disabled?: boolean;
    destructive?: boolean;
}

/**
 * A dropdown-menu action item with its keyboard-shortcut badge. Pure —
 * the hotkey itself is registered separately by the hosting menu via
 * {@link useActionHotkeys}, because a Radix menu only mounts its content while
 * open and the shortcut must work without opening the menu first.
 */
export function MenuAction({
    verb,
    label,
    icon,
    onSelect,
    disabled,
    destructive,
}: MenuActionProps) {
    return (
        <DropdownMenuItem
            onClick={onSelect}
            disabled={disabled}
            className={destructive ? "text-destructive focus:text-destructive" : undefined}
        >
            {icon}
            {label}
            <DropdownMenuShortcut>{formatForDisplay(ActionHotkey[verb])}</DropdownMenuShortcut>
        </DropdownMenuItem>
    );
}
