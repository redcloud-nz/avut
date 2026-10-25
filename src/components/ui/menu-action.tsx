/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import {
    ComponentProps,
    createContext,
    ReactNode,
    RefObject,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

import { useHotkey } from "@tanstack/react-hotkeys";

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
import { ActionHotkey, ACTIONS_MENU_HOTKEY, ActionVerb } from "@/lib/hotkeys";

export interface MenuActionProps {
    /** Action verb — determines the shortcut key and badge via the {@link ActionHotkey} registry
     *  (none for the verbs it has no key for). */
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
    const hotkey = ActionHotkey[verb];

    return (
        <DropdownMenuItem
            onClick={onSelect}
            disabled={disabled}
            className={destructive ? "text-destructive focus:text-destructive" : undefined}
        >
            {icon}
            {label}
            {hotkey && (
                <DropdownMenuShortcut className="max-md:hidden">
                    <HotkeyKbd hotkey={hotkey} />
                </DropdownMenuShortcut>
            )}
        </DropdownMenuItem>
    );
}

export interface EntityActionMenuProps {
    /** Renders the "Actions" group; also drives hotkey registration. */
    actions: MenuActionProps[];
    /** Passed to {@link useMenuActionHotkeys} to group shortcuts in the help overlay. */
    category: string;
    /** Width of the dropdown. Leave it at the default `md` so every entity menu is the same width. */
    size?: ComponentProps<typeof DropdownMenuContent>["size"];
    /** Extra groups rendered above the Actions group (e.g. a History link). */
    before?: ReactNode;
    /** Extra groups rendered below the Actions group (e.g. a D4H section). */
    after?: ReactNode;
    /** Extra `<MenuAction>`s at the end of the Actions group, for actions another module adds
     *  through a page slot. They mount only while the menu is open, so any hotkey for
     *  them is registered from `dialogs` (`useMenuActionHotkeys`). */
    extraActions?: ReactNode;
    /** Rendered beside the menu and always mounted: the dialogs that `extraActions` open. They read the trigger with {@link useEntityActionMenuTrigger}. */
    dialogs?: ReactNode;
    /** Ref on the trigger button, which stays mounted after the menu closes, so a dialog opened
     *  from a menu item can return focus to it (`useReturnFocus`). */
    triggerRef?: RefObject<HTMLButtonElement | null>;
}

const EntityActionMenuTriggerContext = createContext<RefObject<HTMLButtonElement | null> | null>(
    null,
);

/**
 * The enclosing {@link EntityActionMenu}'s trigger button, for a dialog passed in its `dialogs`
 * to return focus to once the menu item that opened it has unmounted.
 */
export function useEntityActionMenuTrigger(): RefObject<HTMLButtonElement | null> | undefined {
    return useContext(EntityActionMenuTriggerContext) ?? undefined;
}

/**
 * The shell shared by every entity detail-page action menu: trigger button,
 * dropdown content, the "Actions" group, and hotkey registration. Entity-specific
 * concerns — which actions exist, their permissions, the `?action=` param, and
 * the dialogs — stay with the caller.
 *
 * Also opens on {@link ACTIONS_MENU_HOTKEY} with its first enabled item focused, so every
 * action is reachable from the keyboard. Use it only for the page-level menu (the one in
 * `Saratoga.Actions`), never for per-row menus, so one page registers the key once.
 */
export function EntityActionMenu({
    actions,
    category,
    size = "md",
    before,
    after,
    extraActions,
    dialogs,
    triggerRef: triggerRefProp,
}: EntityActionMenuProps) {
    useMenuActionHotkeys(actions, category);

    const ownTriggerRef = useRef<HTMLButtonElement>(null);
    const triggerRef = triggerRefProp ?? ownTriggerRef;

    const [open, setOpen] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    // Set when the hotkey opens the menu. Radix focuses the first item only when its own trigger
    // opens the menu from the keyboard; otherwise it focuses the content. Its focus scope mounts
    // (and focuses) before this component's effect runs, so the effect moves focus on from there.
    const openedByHotkey = useRef(false);

    useEffect(() => {
        if (!open || !openedByHotkey.current) return;
        openedByHotkey.current = false;
        contentRef.current
            ?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')
            ?.focus();
    }, [open]);

    useHotkey(
        ACTIONS_MENU_HOTKEY,
        () => {
            openedByHotkey.current = true;
            setOpen(true);
        },
        { preventDefault: true, meta: { name: "Open actions menu", category: "General" } },
    );

    return (
        <EntityActionMenuTriggerContext value={triggerRef}>
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button ref={triggerRef} variant="ghost" size="icon" aria-label="Actions">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent ref={contentRef} size={size} align="end">
                    {before}
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {actions.map((a) => (
                            <MenuAction key={a.verb} {...a} />
                        ))}
                        {extraActions}
                    </DropdownMenuGroup>
                    {after}
                </DropdownMenuContent>
            </DropdownMenu>
            {dialogs}
        </EntityActionMenuTriggerContext>
    );
}
