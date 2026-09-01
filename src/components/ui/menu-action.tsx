/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode } from "react";

import { DropdownMenuItem, DropdownMenuShortcut } from "@/components/ui/dropdown-menu";
import { HotkeyKbd } from "@/components/ui/hotkey-kbd";

import { useActionHotkeys, type ActionHotkeyEntry } from "@/hooks/use-action-hotkeys";
import { ActionHotkey, ActionVerb } from "@/lib/hotkeys";

export interface MenuActionProps {
    /** Action verb — determines the shortcut key and badge via the {@link ActionHotkey} registry. */
    verb: ActionVerb;
    label: string;
    icon: ReactNode;
    onSelect: () => void;
    disabled?: boolean;
    destructive?: boolean;
}

/**
 * Register the `Alt+<key>` hotkeys for a menu's action list — call once at the
 * menu's always-mounted top level (a Radix menu only mounts its content, and
 * thus any `<MenuAction>`, while open). The `<MenuAction>`s render the items.
 */
export function useMenuActionHotkeys(actions: MenuActionProps[], category: string): void {
    const entries: ActionHotkeyEntry[] = actions.map(({ verb, label, onSelect, disabled }) => ({
        verb,
        run: onSelect,
        enabled: !disabled,
        name: label,
        category,
    }));
    useActionHotkeys(entries);
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
            <DropdownMenuShortcut>
                <HotkeyKbd hotkey={ActionHotkey[verb]} />
            </DropdownMenuShortcut>
        </DropdownMenuItem>
    );
}
