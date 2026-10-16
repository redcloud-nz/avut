"use client";

import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className={cn(
                "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
                className,
            )}
            {...props}
        />
    );
}

/**
 * Responsive by design: below `sm` the dialog takes over the whole screen (slides up, with a
 * visible close button, since there's no overlay left to tap); from `sm` up it's the usual
 * centred modal that fades and zooms in. Same Radix primitive either way, so focus trap / Escape
 * / Back-button dismissal are identical.
 *
 * `mobile="sheet"` swaps the full-screen takeover for a bottom sheet below `sm`, as tall as its
 * content (capped at 92dvh, with the body scrolling past that), like `AlertDialogContent`. Use it
 * for a short, one-tap dialog that isn't a destructive confirm (that's `AlertDialog`'s job).
 * From `sm` up it's the same centred modal either way. The sheet's bottom safe-area inset comes
 * from `DialogFooter`, or `DialogBody` when no footer follows it; a sheet that lays itself out
 * without either must pad its own bottom with `env(safe-area-inset-bottom)`.
 *
 * `DialogContent` owns no padding. Compose it from three regions — `DialogHeader`, `DialogBody`
 * and `DialogFooter` — each of which owns its own padding, so the body is the only part that
 * scrolls and the header and footer stay put at every size:
 *
 *     <DialogContent>
 *         <DialogHeader>…</DialogHeader>
 *         <DialogBody>…fields…</DialogBody>
 *         <DialogFooter>…buttons…</DialogFooter>
 *     </DialogContent>
 *
 * Dialogs that manage their own scrolling (a `Command` picker, an image lightbox) can skip
 * `DialogBody` and lay themselves out inside the padding-free content.
 */
function DialogContent({
    className,
    children,
    showCloseButton = true,
    size = "default",
    mobile = "fullscreen",
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
    /** Width of the centred modal from `sm` up: 448 / 512 / 672px. Below `sm` it's full width regardless. */
    size?: "default" | "lg" | "xl";
    /** Below `sm`: take over the whole screen (the default), or sit as a bottom sheet as tall as its content. */
    mobile?: "fullscreen" | "sheet";
}) {
    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
                data-slot="dialog-content"
                className={cn(
                    // Full screen (below `sm`)
                    "group/dialog-content fixed inset-0 z-50 flex w-full flex-col overflow-hidden bg-popover text-sm text-popover-foreground outline-none data-open:animate-in data-open:slide-in-from-bottom data-open:duration-200 data-closed:animate-out data-closed:slide-out-to-bottom data-closed:duration-150",
                    // Bottom sheet (below `sm`, `mobile="sheet"`): drops the top edge so the sheet rests on the
                    // bottom one, as tall as its content up to 92dvh. Every class is `max-sm:`-scoped so none
                    // of them fight the centred-modal classes below.
                    "max-sm:data-[mobile=sheet]:top-auto max-sm:data-[mobile=sheet]:max-h-[92dvh] max-sm:data-[mobile=sheet]:rounded-t-2xl max-sm:data-[mobile=sheet]:ring-1 max-sm:data-[mobile=sheet]:ring-foreground/10",
                    // Centred modal (`sm` and up)
                    "sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:max-h-[calc(100dvh-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:ring-1 sm:ring-foreground/10 sm:data-open:fade-in-0 sm:data-open:zoom-in-95 sm:data-open:slide-in-from-bottom-0 sm:data-open:duration-100 sm:data-closed:fade-out-0 sm:data-closed:zoom-out-95 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:duration-100",
                    // Width (`sm` and up). The default is a bare `sm:max-w-md` so tailwind-merge still drops
                    // it for a caller's own `sm:max-w-*` (the screenshot lightboxes); the larger sizes
                    // outrank it by their `data-size` selector.
                    "sm:max-w-md data-[size=lg]:sm:max-w-lg data-[size=xl]:sm:max-w-2xl",
                    className,
                )}
                data-size={size}
                data-mobile={mobile}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close data-slot="dialog-close" asChild>
                        <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm">
                            <XIcon />
                            <span className="sr-only">Close</span>
                        </Button>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DialogPortal>
    );
}

/**
 * The dialog's scrolling region, between `DialogHeader` and `DialogFooter`. It takes the space
 * they leave (`min-h-0 flex-1`) and scrolls internally when its content is taller, so the header
 * and footer never scroll away and a tall form never pushes them off a small screen — with no
 * height guess of its own. Owns the horizontal and bottom padding around the content (the
 * header above supplies the space at the top) and lays its children out as a `gap-4` column.
 * A thin styled scrollbar (`scrollbar-color`, matching `Std.ScrollContainer`) appears when it
 * overflows; `scrollbar-gutter: stable` keeps the content from shifting when it does. It never
 * scrolls sideways: horizontal overflow is clipped (the `px-4` leaves room for focus rings), so a
 * child that pokes past the edge — `input-otp` widening its hidden input by 40px to clear a
 * password-manager badge, say — can't add a horizontal scrollbar.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-body"
            className={cn(
                "flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-4 [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)] [scrollbar-gutter:stable]",
                // In a bottom sheet with no footer after it, the body is the bottom edge, so its padding
                // grows by the safe-area inset (a footer does this itself). Not `last:`, since the close
                // button renders after the regions.
                "max-sm:group-data-[mobile=sheet]/dialog-content:[&:not(:has(~[data-slot=dialog-footer]))]:pb-[max(1rem,env(safe-area-inset-bottom))]",
                className,
            )}
            {...props}
        />
    );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-header"
            className={cn(
                // Supplies the space below it too (so a header directly above a footer, with no body,
                // is still spaced), and the top padding grows by the safe-area inset when full screen
                // (not in a bottom sheet, whose top edge isn't the screen's)
                "flex shrink-0 flex-col gap-2 p-4 max-sm:pt-[max(1rem,env(safe-area-inset-top))] max-sm:group-data-[mobile=sheet]/dialog-content:pt-4",
                className,
            )}
            {...props}
        />
    );
}

function DialogFooter({
    className,
    showCloseButton = false,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    showCloseButton?: boolean;
}) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                // Full screen: the buttons are 36px tall and share the row for a bigger tap target
                // (`flex-1` keeps each at least its label width, so a long label wraps to another row
                // rather than getting squeezed), and the bottom padding grows by the safe-area inset.
                // The dialog's own `overflow-hidden` rounds the footer's bottom corners at `sm` up.
                "flex shrink-0 flex-wrap justify-end gap-2 border-t bg-muted/50 px-4 py-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:*:h-9 max-sm:*:flex-1",
                className,
            )}
            {...props}
        >
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close asChild>
                    <Button variant="outline">Close</Button>
                </DialogPrimitive.Close>
            )}
        </div>
    );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn("font-heading text-base leading-none font-medium", className)}
            {...props}
        />
    );
}

function DialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn(
                "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
                className,
            )}
            {...props}
        />
    );
}

export function DialogCloseButton(props: React.ComponentProps<typeof Button>) {
    return (
        <DialogPrimitive.Close asChild>
            <Button {...props} />
        </DialogPrimitive.Close>
    );
}

export type DialogProps = React.ComponentProps<typeof Dialog>;

export {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
