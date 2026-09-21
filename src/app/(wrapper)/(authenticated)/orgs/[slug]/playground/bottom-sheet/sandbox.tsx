/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

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
import { DialogBoundary } from "@/components/ui/dialog-boundary";
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

/**
 * Stand-in for a dialogue that fetches its own data: a suspense query that resolves after a
 * delay (or throws). `gcTime: 0` so every open fetches afresh, like a dialogue mounted on open.
 * With `headerFromData` the header depends on the result, so it lives in here and the boundary is
 * given a `fallbackHeader` for the loading and error states.
 */
function SandboxSlowData({
    delayMs,
    fail,
    headerFromData,
}: {
    delayMs: number;
    fail: boolean;
    headerFromData: boolean;
}) {
    const { data } = useSuspenseQuery({
        queryKey: ["playground", "slow-dialogue", delayMs, fail],
        queryFn: async () => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            if (fail) throw new Error("Couldn't load the list. The server said no.");
            return { title: "Three people found", people: ["Ada", "Grace", "Katherine"] };
        },
        gcTime: 0,
        retry: false,
    });

    return (
        <>
            {headerFromData && (
                <DialogHeader>
                    <DialogTitle>{data.title}</DialogTitle>
                    <DialogDescription>The header came from the fetched data.</DialogDescription>
                </DialogHeader>
            )}
            <DialogBody>
                <ul className="list-disc pl-5">
                    {data.people.map((person) => (
                        <li key={person}>{person}</li>
                    ))}
                </ul>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <Button type="button">Choose</Button>
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

// AlertDialogContent stays compact: a bottom sheet below sm, centred from sm up.

// A dialogue that waits on data puts a DialogBoundary between the header and the body/footer.
// While it loads: header stays, spinner where the body will be, no footer. If it throws: the
// error and a Close button. A header that depends on the data lives inside and is repeated
// (neutral) as fallbackHeader.
<DialogContent>
  <DialogHeader>…</DialogHeader>
  <DialogBoundary>
    <Inner /> {/* useSuspenseQuery; returns <DialogBody> + <DialogFooter> */}
  </DialogBoundary>
</DialogContent>`;

export function BottomSheet_Sandbox() {
    const [longForm, setLongForm] = useState(true);
    const [slowMs, setSlowMs] = useState(1500);
    const [failFetch, setFailFetch] = useState(false);

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
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <Switch id="long-form" checked={longForm} onCheckedChange={setLongForm} />
                        <Label htmlFor="long-form">
                            Long form (adds Location, Duration, Team, Lead assessor, Instructions,
                            and two checkboxes — tall enough to force scrolling on a phone)
                        </Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            id="fail-fetch"
                            checked={failFetch}
                            onCheckedChange={setFailFetch}
                        />
                        <Label htmlFor="fail-fetch">Make the “slow data” fetch fail</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="slow-ms">Fetch delay (ms)</Label>
                        <Input
                            id="slow-ms"
                            type="number"
                            className="w-28"
                            value={slowMs}
                            onChange={(e) => setSlowMs(Number(e.target.value) || 0)}
                        />
                    </div>
                </div>
            }
            onReset={() => {
                setLongForm(true);
                setFailFetch(false);
                setSlowMs(1500);
            }}
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

                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline">Slow data</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Choose a person</DialogTitle>
                            <DialogDescription>
                                The header is static, so it sits outside the boundary.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogBoundary>
                            <SandboxSlowData
                                delayMs={slowMs}
                                fail={failFetch}
                                headerFromData={false}
                            />
                        </DialogBoundary>
                    </DialogContent>
                </Dialog>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline">Slow data (header from data)</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogBoundary
                            fallbackHeader={
                                <DialogHeader>
                                    <DialogTitle>People</DialogTitle>
                                    <DialogDescription>
                                        Neutral wording: this also shows if loading fails.
                                    </DialogDescription>
                                </DialogHeader>
                            }
                        >
                            <SandboxSlowData delayMs={slowMs} fail={failFetch} headerFromData />
                        </DialogBoundary>
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
