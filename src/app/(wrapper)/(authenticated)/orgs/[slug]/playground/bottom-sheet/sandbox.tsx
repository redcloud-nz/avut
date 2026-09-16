/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ComponentProps, useState } from "react";

import { DatePicker } from "@/components/controls/date-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogScrollableBody,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { Harness } from "../_components/harness";

/**
 * Prototype only — not the shared `DialogContent`. Same Radix Dialog primitive as
 * the real one (identical focus trap / Escape / overlay behaviour), styled to sit
 * flush against the bottom edge below `sm` and fall back to the normal centered
 * modal at `sm` and up.
 *
 * This intentionally does NOT respond to the Harness width toggle above — that
 * only resizes a container, while this positions against the real viewport via
 * `sm:` (a media query, not a container query). Judge it by narrowing the actual
 * browser window, or better, opening this page on a phone.
 */
function BottomSheetDialogContent({
    className,
    children,
    showCloseButton = true,
    ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
                data-slot="dialog-content"
                className={cn(
                    "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-popover p-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:slide-in-from-bottom data-open:duration-200 data-closed:animate-out data-closed:slide-out-to-bottom data-closed:duration-150",
                    "sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pt-4 sm:data-open:fade-in-0 sm:data-open:zoom-in-95 sm:data-open:slide-in-from-bottom-0 sm:data-closed:fade-out-0 sm:data-closed:zoom-out-95 sm:data-closed:slide-out-to-bottom-0",
                    className,
                )}
                {...props}
            >
                <div
                    aria-hidden
                    // Above: pt-3, offset by -mt-1, nets 0.5rem to the sheet's top edge. Below:
                    // the parent's own gap-4 (1rem) applies too, on top of any margin here — -mb-2
                    // nets 1rem - 0.5rem = 0.5rem, matching the top gap.
                    className="mx-auto -mt-1 -mb-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden"
                />
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close data-slot="dialog-close" asChild>
                        <Button
                            variant="ghost"
                            // Hidden below sm — dismiss via the overlay tap or Escape instead. A
                            // real bottom sheet would also support swipe-to-dismiss, but that's a
                            // drag gesture this prototype doesn't wire up (the handle below is
                            // decorative only) — e.g. `vaul`, which shadcn's own Drawer wraps.
                            className="absolute top-2 right-2 hidden sm:inline-flex"
                            size="icon-sm"
                        >
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
 * Same "New Session" fields as `skill-track/create-session.tsx`, minus the form wiring — this is
 * a layout comparison, not a real mutation.
 *
 * `DialogFooter` is always a `shrink-0` flex sibling, so its buttons never scroll away — that part
 * matches `create-session.tsx` and most other current mutation dialogs, which render their fields
 * directly rather than through `DialogScrollableBody` and so have the same latent "footer scrolls
 * away" gap today; it just doesn't show up until a dialog's content is tall enough, or the
 * viewport is squeezed by the keyboard, to need scrolling at all.
 *
 * `pinHeader` controls whether `DialogHeader` sits outside the scrollable body (pinned, like the
 * footer) or scrolls away with the fields. Pinning both ends leaves very little room for content
 * once the keyboard has also eaten a chunk of the viewport — the sheet variant passes `false` and
 * only keeps the footer fixed, trading "title always visible" for more usable field space.
 */
function SandboxSessionFields({
    idPrefix,
    pinHeader = true,
    longForm = false,
}: {
    idPrefix: string;
    pinHeader?: boolean;
    longForm?: boolean;
}) {
    const [name, setName] = useState("");
    const [date, setDate] = useState<string | undefined>(new Date().toISOString());
    const [notes, setNotes] = useState("");
    const [location, setLocation] = useState("");
    const [duration, setDuration] = useState("");
    const [leadAssessor, setLeadAssessor] = useState("");
    const [team, setTeam] = useState<string | undefined>(undefined);
    const [instructions, setInstructions] = useState("");
    const [notify, setNotify] = useState(true);
    const [allowLateCheckIns, setAllowLateCheckIns] = useState(false);

    const header = (
        <DialogHeader>
            <DialogTitle>New Session</DialogTitle>
            <DialogDescription>
                Create a new skill check session. You can add skill checks to the session after
                it&apos;s created.
            </DialogDescription>
        </DialogHeader>
    );

    const fields = (
        <FieldGroup>
            <Field>
                <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
                <Input
                    id={`${idPrefix}-name`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Session Name"
                />
            </Field>
            <Field>
                <FieldLabel htmlFor={`${idPrefix}-date`}>Date</FieldLabel>
                <DatePicker id={`${idPrefix}-date`} value={date} onValueChange={setDate} />
            </Field>
            {longForm && (
                <>
                    <Field>
                        <FieldLabel htmlFor={`${idPrefix}-location`}>Location</FieldLabel>
                        <Input
                            id={`${idPrefix}-location`}
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Station 4, main hall"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor={`${idPrefix}-duration`}>Duration (minutes)</FieldLabel>
                        <Input
                            id={`${idPrefix}-duration`}
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="90"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor={`${idPrefix}-team`}>Team</FieldLabel>
                        <Select value={team} onValueChange={setTeam}>
                            <SelectTrigger id={`${idPrefix}-team`} className="w-full">
                                <SelectValue placeholder="Select a team" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="alpha">Alpha</SelectItem>
                                <SelectItem value="bravo">Bravo</SelectItem>
                                <SelectItem value="charlie">Charlie</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field>
                        <FieldLabel htmlFor={`${idPrefix}-lead-assessor`}>Lead assessor</FieldLabel>
                        <Input
                            id={`${idPrefix}-lead-assessor`}
                            value={leadAssessor}
                            onChange={(e) => setLeadAssessor(e.target.value)}
                            placeholder="Jordan Rivers"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor={`${idPrefix}-instructions`}>
                            Instructions for assessors
                        </FieldLabel>
                        <Textarea
                            id={`${idPrefix}-instructions`}
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="Run the wet-weather variant of the drill; check radios beforehand."
                        />
                    </Field>
                    <Field orientation="horizontal">
                        <Checkbox
                            id={`${idPrefix}-notify`}
                            checked={notify}
                            onCheckedChange={(checked) => setNotify(checked === true)}
                        />
                        <FieldLabel htmlFor={`${idPrefix}-notify`}>
                            Notify assigned personnel
                        </FieldLabel>
                    </Field>
                    <Field orientation="horizontal">
                        <Checkbox
                            id={`${idPrefix}-late-checkins`}
                            checked={allowLateCheckIns}
                            onCheckedChange={(checked) => setAllowLateCheckIns(checked === true)}
                        />
                        <FieldLabel htmlFor={`${idPrefix}-late-checkins`}>
                            Allow late check-ins
                        </FieldLabel>
                    </Field>
                </>
            )}
            <Field>
                <FieldLabel htmlFor={`${idPrefix}-notes`}>Notes</FieldLabel>
                <Textarea
                    id={`${idPrefix}-notes`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Session Notes"
                />
            </Field>
        </FieldGroup>
    );

    return (
        <>
            {pinHeader ? (
                <>
                    {header}
                    <DialogScrollableBody>{fields}</DialogScrollableBody>
                </>
            ) : (
                <DialogScrollableBody>
                    {header}
                    {fields}
                </DialogScrollableBody>
            )}
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <Button type="button">Create</Button>
            </DialogFooter>
        </>
    );
}

const CODE = `// sm and up: unchanged from the real DialogContent
"fixed top-1/2 left-1/2 ... -translate-x-1/2 -translate-y-1/2 rounded-xl"

// below sm: pinned to the bottom edge instead of centered
"fixed inset-x-0 bottom-0 w-full rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
// + a drag-handle affordance, shown only below sm
<div className="mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />
// the close button is hidden below sm — dismiss via the overlay tap or Escape instead
// (a real sheet would add swipe-to-dismiss too, e.g. via vaul; not wired up here)
<Button className="absolute top-2 right-2 hidden sm:inline-flex" ... />

// only the footer is pinned (shrink-0) — the header goes through
// DialogScrollableBody with the fields, so pinning both ends doesn't
// squeeze content space once the keyboard has also shrunk the viewport
<DialogScrollableBody>{header}{fields}</DialogScrollableBody>
<DialogFooter>...</DialogFooter>`;

export function BottomSheet_Sandbox() {
    const [openCurrent, setOpenCurrent] = useState(false);
    const [openSheet, setOpenSheet] = useState(false);
    const [longForm, setLongForm] = useState(true);

    return (
        <Harness
            title="Bottom sheet on mobile"
            description={
                "Same form, two DialogContent variants: the current centered modal, and a prototype " +
                "that pins to the bottom edge below sm with rounded top corners, a (currently " +
                "decorative) drag-handle affordance, safe-area-aware bottom padding, no close " +
                "button (dismiss via the overlay or Escape instead — swipe-to-dismiss isn't " +
                "wired up here), and a footer that stays put while everything above it — title, " +
                "description, and fields together — scrolls as one region. Only the footer is " +
                "pinned: pinning the header too left very little room for content once the " +
                "keyboard also ate a chunk of the viewport. Both variants use the same Radix " +
                "Dialog primitive underneath, so accessibility behaviour is identical — only " +
                "shape and position differ. Best judged on an actual phone; the width toggle " +
                "above won't trigger this, since it's a viewport media query (sm:), not a " +
                "container query."
            }
            code={CODE}
            controls={
                <div className="flex items-center gap-2">
                    <Switch id="long-form" checked={longForm} onCheckedChange={setLongForm} />
                    <Label htmlFor="long-form">
                        Long form (adds Location, Duration, Team, Lead assessor, Instructions, and
                        two checkboxes — tall enough to force scrolling on a phone)
                    </Label>
                </div>
            }
            onReset={() => setLongForm(true)}
        >
            <div className="flex flex-wrap items-center gap-3">
                <Dialog open={openCurrent} onOpenChange={setOpenCurrent}>
                    <DialogTrigger asChild>
                        <Button variant="outline">Open current dialogue</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <SandboxSessionFields idPrefix="current" longForm={longForm} />
                    </DialogContent>
                </Dialog>

                <Dialog open={openSheet} onOpenChange={setOpenSheet}>
                    <DialogTrigger asChild>
                        <Button variant="outline">Open bottom sheet concept</Button>
                    </DialogTrigger>
                    <BottomSheetDialogContent>
                        <SandboxSessionFields
                            idPrefix="sheet"
                            pinHeader={false}
                            longForm={longForm}
                        />
                    </BottomSheetDialogContent>
                </Dialog>
            </div>
        </Harness>
    );
}
