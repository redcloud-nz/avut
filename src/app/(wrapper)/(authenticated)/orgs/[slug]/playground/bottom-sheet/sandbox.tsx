/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { DatePicker } from "@/components/controls/date-picker";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
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

import { Harness } from "../_components/harness";

/**
 * Same "New Session" fields as `skill-track/create-session.tsx`, minus the form wiring — this is
 * a layout comparison, not a real mutation. Header / Body / Footer: the body is the only part
 * that scrolls, and the header and footer stay put.
 */
function SandboxSessionFields({
    idPrefix,
    longForm = false,
}: {
    idPrefix: string;
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
            {header}
            <DialogBody>{fields}</DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <Button type="button">Create</Button>
            </DialogFooter>
        </>
    );
}

const CODE = `// DialogContent has no padding of its own — compose it from three regions.
// The body is the only part that scrolls; header and footer stay put.
<DialogContent>
  <DialogHeader>…</DialogHeader>
  <DialogBody>…fields…</DialogBody>
  <DialogFooter>…buttons…</DialogFooter>
</DialogContent>

// below sm: DialogContent is full screen (slides up, visible close button,
//           footer buttons share the row, safe-area aware)
// sm and up: the centred modal (fade + zoom), close button top-right

// AlertDialogContent stays compact: a bottom sheet below sm, centred from sm up.`;

export function BottomSheet_Sandbox() {
    const [longForm, setLongForm] = useState(true);

    return (
        <Harness
            title="Dialogues on mobile"
            description={
                "The real DialogContent, composed from DialogHeader / DialogBody / DialogFooter. " +
                "Below sm it takes over the whole screen (with a close button, since there's no " +
                "overlay left to tap); from sm up it's the centred modal. Only the body scrolls — " +
                "the header and footer stay put at every size. Alert dialogues stay compact: a " +
                "bottom sheet below sm, centred from sm up. The width toggle above won't trigger " +
                "any of this, since it's a viewport media query (sm:), not a container query — " +
                "judge it by narrowing the browser window or, better, opening this page on a " +
                "phone. Toggle the long form to check scrolling, and tap into a field to check the " +
                "on-screen keyboard doesn't hide the footer."
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
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline">Dialogue</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <SandboxSessionFields idPrefix="dialogue" longForm={longForm} />
                    </DialogContent>
                </Dialog>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline">Alert dialogue</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This permanently removes the session and its skill checks. This
                                can&apos;t be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline">Alert dialogue (size sm)</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                            <AlertDialogDescription>
                                You have unsaved changes.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Keep editing</AlertDialogCancel>
                            <AlertDialogAction>Discard</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </Harness>
    );
}
