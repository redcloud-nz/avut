/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Slot } from "radix-ui";
import {
    Children,
    ComponentProps,
    createContext,
    ReactNode,
    Ref,
    RefObject,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

import { useHotkeys } from "@tanstack/react-hotkeys";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MenuAction,
    useMenuActionHotkeys,
    type MenuActionProps,
} from "@/components/ui/menu-action";
import { ActionHotkey, ACTIONS_MENU_HOTKEY } from "@/lib/hotkeys";

// See docs/patterns/detail-page-actions.md for where each of these goes on a detail page.

export interface RecordCardMenuProps {
    /** The record's non-primary actions, already filtered to what the viewer can take now:
     *  leave out an action the viewer lacks the permission for or the record's state rules out,
     *  rather than disabling it. `disabled` is only for a short-lived in-flight state. */
    actions: MenuActionProps[];
    /** Groups the shortcuts in the help overlay ("Personnel", "Sessions", …). */
    category: string;
    /** Extra groups below the actions (e.g. a D4H section). Pass `null`, not a component that
     *  renders null, when there's nothing to add: an empty menu renders no trigger. */
    after?: ReactNode;
    /** Set on the page's primary record card (the one its `<h1>` names): registers the verb
     *  shortcuts (⌥⌫, ⌥A) and {@link ACTIONS_MENU_HOTKEY}. Other cards' menus register none. */
    primary?: boolean;
    /** Ref on the trigger button, for a dialog opened from a menu item to return focus to
     *  (`useReturnFocus(fallbackRef)`) once the item has unmounted. */
    triggerRef?: RefObject<HTMLButtonElement | null>;
    /** The trigger's accessible name. Defaults to "Actions"; name the card on a page with more
     *  than one menu ("Linked user actions"). */
    label?: string;
}

const RecordCardMenuTriggerContext = createContext<RefObject<HTMLButtonElement | null> | null>(
    null,
);

/**
 * The enclosing {@link RecordCardMenu}'s trigger button, for content rendered inside the menu
 * (its `after` groups) that opens a dialog and needs somewhere to return focus. Dialogs mounted
 * beside the menu take the menu's `triggerRef` instead.
 */
export function useRecordCardMenuTrigger(): RefObject<HTMLButtonElement | null> | undefined {
    return useContext(RecordCardMenuTriggerContext) ?? undefined;
}

/**
 * A record card's ⋮, for its `action` slot after the card's icons: the record's non-primary
 * actions (Archive, Delete, Unlink, Move, …). Renders nothing when there are no actions and no
 * `after`. The items only set `?action=`; the page's dialogs stay mounted elsewhere, once.
 *
 * With `primary`, also opens on {@link ACTIONS_MENU_HOTKEY} with its first enabled item focused.
 */
export function RecordCardMenu({
    actions,
    category,
    after = null,
    primary = false,
    triggerRef: triggerRefProp,
    label = "Actions",
}: RecordCardMenuProps) {
    // Hooks for a non-primary menu register nothing at all: a disabled registration would still
    // collide with the primary card's (the hotkey library warns on a duplicate key).
    useMenuActionHotkeys(primary ? actions : [], category);

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

    const isEmpty = actions.length === 0 && after === null;

    useHotkeys(
        primary && !isEmpty
            ? [
                  {
                      hotkey: ACTIONS_MENU_HOTKEY,
                      callback: () => {
                          openedByHotkey.current = true;
                          setOpen(true);
                      },
                      options: {
                          preventDefault: true,
                          meta: { name: "Open actions menu", category: "General" },
                      },
                  },
              ]
            : [],
    );

    if (isEmpty) return null;

    return (
        <RecordCardMenuTriggerContext value={triggerRef}>
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button ref={triggerRef} variant="ghost" size="icon" aria-label={label}>
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent ref={contentRef} align="end">
                    {actions.length > 0 && (
                        <DropdownMenuGroup>
                            {actions.map((a) => (
                                <MenuAction key={a.verb} {...a} />
                            ))}
                        </DropdownMenuGroup>
                    )}
                    {after}
                </DropdownMenuContent>
            </DropdownMenu>
        </RecordCardMenuTriggerContext>
    );
}

export type RecordCardEditButtonProps = Omit<ComponentProps<typeof Button>, "variant" | "size"> & {
    /** The accessible name ("Edit person"), also the tooltip. */
    label: string;
    /** Set on the page's primary record card: ⌥E clicks this button. */
    primary?: boolean;
    /** Groups the shortcut in the help overlay, as the card's {@link RecordCardMenu} does. */
    category?: string;
};

/**
 * A record card's edit pencil, for its `action` slot. Spreads its props and forwards its ref, so
 * it works as `<DialogTrigger asChild>`'s child (the update dialog's own trigger) or, with
 * `asChild`, around a `<Link>` to an edit route. With `primary`, ⌥E clicks it, so the shortcut
 * does whatever clicking does.
 */
export function RecordCardEditButton({
    label,
    primary = false,
    category,
    ref,
    children,
    ...props
}: RecordCardEditButtonProps) {
    const ownRef = useRef<HTMLButtonElement | null>(null);
    const setRef = useCallback(
        (node: HTMLButtonElement | null) => {
            ownRef.current = node;
            assignRef(ref, node);
        },
        [ref],
    );

    useHotkeys(
        primary && ActionHotkey.update
            ? [
                  {
                      hotkey: ActionHotkey.update,
                      // The pencil is usually a Radix `DialogTrigger`, whose click toggles: don't let a
                      // second ⌥E close the open dialog and lose the edits.
                      callback: () => {
                          if (ownRef.current?.getAttribute("aria-expanded") === "true") return;
                          ownRef.current?.click();
                      },
                      options: {
                          enabled: !props.disabled,
                          preventDefault: true,
                          meta: { name: label, category },
                      },
                  },
              ]
            : [],
    );

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            title={label}
            {...props}
            ref={setRef}
        >
            <ObjectIcons.Edit />
            {/* With `asChild`, the caller's element (a `Link`) becomes the button and the pencil
                renders inside it. */}
            <Slot.Slottable>{children}</Slot.Slottable>
        </Button>
    );
}

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
    if (typeof ref === "function") ref(value);
    else if (ref) ref.current = value;
}

/**
 * A card at the top of a detail page's secondary column for the page's primary actions that
 * need words: Record, Review, Publishing, Invite to AVUT.
 *
 * - **Titled** (`title`, and usually a one-line `description`) when the action needs explaining
 *   or the page has more than one job.
 * - **Bare** (no `title`) when the button labels say it all: just the stacked buttons.
 *
 * Pass the buttons the viewer can take now as children, `null` for one they can't: the card
 * renders nothing when none are left. Gate each with `useHasPermission`, never `<Protect>`: a
 * `Protect` element counts as a child even when it renders nothing. Buttons are `outline`, except the one that moves the
 * record to its next lifecycle state (default, filled), at most one per page. They only set
 * `?action=` or link; no hotkeys.
 */
export function ActionsCard({
    title,
    description,
    children,
}: {
    title?: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
}) {
    if (Children.toArray(children).length === 0) return null;

    if (!title) {
        return (
            <Card data-component="ActionsCard" className="py-0">
                <CardContent className="flex flex-col gap-2 p-3">{children}</CardContent>
            </Card>
        );
    }

    return (
        <Card data-component="ActionsCard" className="gap-3 py-4">
            <CardHeader className="px-4">
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-4">{children}</CardContent>
        </Card>
    );
}
