/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode } from "react";

import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
            <DropdownMenuShortcut className="max-md:hidden">
                <HotkeyKbd hotkey={ActionHotkey[verb]} />
            </DropdownMenuShortcut>
        </DropdownMenuItem>
    );
}

export interface EntityActionMenuProps {
    /** Renders the "Actions" group; also drives hotkey registration. */
    actions: MenuActionProps[];
    /** Passed to {@link useMenuActionHotkeys} to group shortcuts in the help overlay. */
    category: string;
    /** Width class for the dropdown content. */
    width?: string;
    /** Extra groups rendered above the Actions group (e.g. a History link). */
    before?: ReactNode;
    /** Extra groups rendered below the Actions group (e.g. a D4H section). */
    after?: ReactNode;
}

/**
 * The shell shared by every entity detail-page action menu: trigger button,
 * dropdown content, the "Actions" group, and hotkey registration. Entity-specific
 * concerns — which actions exist, their permissions, the `?action=` param, and
 * the dialogs — stay with the caller.
 */
export function EntityActionMenu({
    actions,
    category,
    width = "w-50",
    before,
    after,
}: EntityActionMenuProps) {
    useMenuActionHotkeys(actions, category);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <DropdownMenuTriggerIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className={width} align="end">
                {before}
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    {actions.map((a) => (
                        <MenuAction key={a.verb} {...a} />
                    ))}
                </DropdownMenuGroup>
                {after}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
