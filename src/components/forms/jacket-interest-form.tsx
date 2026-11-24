/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { CheckIcon, RotateCwIcon } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";

import { useMutation } from "@tanstack/react-query";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { J307_JACKET, JACKET_TEAMS, type JacketTeam } from "@/lib/j307-jacket";
import {
    JACKET_INTEREST_CHOICES,
    JACKET_NAME_MAX,
    JACKET_NOTES_MAX,
} from "@/lib/schemas/jacket-interest";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

import { ChoiceChips, TextField } from "./form-fields";
import { SizeChart } from "./size-chart";

type Interest = (typeof JACKET_INTEREST_CHOICES)[number];

const INTEREST_LABELS: Record<Interest, string> = { yes: "Yes", no: "No", unsure: "Not sure" };

type Side = "front" | "back";

type Answer = {
    team: JacketTeam | null;
    name: string;
    interest: Interest | null;
    fit: string;
    size: string;
    notes: string;
};

type Errors = Partial<Record<"team" | "name" | "interest" | "fit" | "size", string>>;

/** Chips over the photo sit on its white panel, so they keep a light look in both themes. */
const PHOTO_CHIP =
    "border-neutral-300 px-3 text-black hover:bg-neutral-100 hover:text-black data-[state=on]:bg-black data-[state=on]:text-white";

const EMPTY_ANSWER: Answer = {
    team: null,
    name: "",
    interest: null,
    fit: J307_JACKET.fits[0].id,
    size: "",
    notes: "",
};

function answerErrors(answer: Answer): Errors {
    const errors: Errors = {};
    if (answer.team === null) errors.team = "Please pick your team.";
    if (answer.name.trim() === "") errors.name = "Please give your name.";
    if (answer.interest === null) errors.interest = "Please answer this one.";
    if (answer.interest === "yes") {
        const fit = J307_JACKET.fits.find((f) => f.id === answer.fit);
        if (!fit) errors.fit = "Please pick a fit.";
        else if (!fit.sizes.some(({ size }) => size === answer.size))
            errors.size = "Please give your size.";
    }
    return errors;
}

/**
 * The soft shell jacket interest form: photos (fit and front/back), what it is, the size chart,
 * then team, name, "would you use one?" with fit and size, and comments. Sending stores the
 * answer (`publicForms.submitJacketInterest`, checked by BotID). The fit picked in the answer and
 * the fit shown in the photos are the same choice.
 */
export function JacketInterest_Form() {
    const jacket = J307_JACKET;
    const formId = useId();
    const [answer, setAnswer] = useState<Answer>(EMPTY_ANSWER);
    const [honeypot, setHoneypot] = useState("");
    const [side, setSide] = useState<Side>("front");
    const [showErrors, setShowErrors] = useState(false);
    const [sent, setSent] = useState<Answer | null>(null);

    const submit = useMutation(
        trpc.publicForms.submitJacketInterest.mutationOptions({
            onSuccess: (_data, variables) => {
                setSent({ ...answer, name: variables.answer.name });
                window.scrollTo({ top: 0 });
            },
        }),
    );

    const fit = jacket.fits.find((f) => f.id === answer.fit) ?? jacket.fits[0];
    const errors = showErrors ? answerErrors(answer) : {};
    const update = (patch: Partial<Answer>) => setAnswer((prev) => ({ ...prev, ...patch }));

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (submit.isPending) return;
        const found = answerErrors(answer);
        if (Object.keys(found).length > 0 || answer.team === null || answer.interest === null) {
            setShowErrors(true);
            return;
        }
        submit.mutate({
            answer: {
                team: answer.team,
                name: answer.name.trim(),
                interest: answer.interest,
                fit: answer.interest === "yes" ? answer.fit : "",
                size: answer.interest === "yes" ? answer.size : "",
                notes: answer.notes.trim(),
            },
            website: honeypot,
        });
    };

    if (sent) {
        return (
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Thanks, {sent.name}!</CardTitle>
                        <CardDescription>We&apos;ve got your answer.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                            <dt className="text-muted-foreground">Team</dt>
                            <dd>{sent.team}</dd>
                            <dt className="text-muted-foreground">Would use one</dt>
                            <dd>{sent.interest ? INTEREST_LABELS[sent.interest] : "—"}</dd>
                            {sent.interest === "yes" && (
                                <>
                                    <dt className="text-muted-foreground">Size</dt>
                                    <dd>
                                        {jacket.fits.find((f) => f.id === sent.fit)?.label}{" "}
                                        {sent.size}
                                    </dd>
                                </>
                            )}
                            <dt className="text-muted-foreground">Comments</dt>
                            <dd className="whitespace-pre-wrap">{sent.notes || "—"}</dd>
                        </dl>
                        <p className="text-sm text-muted-foreground">
                            Got something wrong? Send it again and we&apos;ll use your latest
                            answer.
                        </p>
                        <Button
                            variant="outline"
                            className="self-start"
                            onClick={() => {
                                setSent(null);
                                setShowErrors(false);
                                submit.reset();
                            }}
                        >
                            Change my answer
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
            <Card className="overflow-hidden pt-0">
                <div className="relative aspect-[11/10] bg-white">
                    {jacket.fits.flatMap((f) =>
                        (["front", "back"] as const).map((s) => {
                            const image = f.images[s];
                            const visible = f.id === fit.id && s === side;
                            return (
                                <Image
                                    key={`${f.id}-${s}`}
                                    src={image.src}
                                    alt={image.alt}
                                    width={image.width}
                                    height={image.height}
                                    priority={f.id === jacket.fits[0].id && s === "front"}
                                    aria-hidden={!visible}
                                    className={cn(
                                        "absolute inset-0 size-full object-contain p-4 transition-opacity duration-300",
                                        visible ? "opacity-100" : "opacity-0",
                                    )}
                                />
                            );
                        }),
                    )}
                    <button
                        type="button"
                        onClick={() => setSide(side === "front" ? "back" : "front")}
                        aria-label={side === "front" ? "Show the back" : "Show the front"}
                        title={side === "front" ? "Show the back" : "Show the front"}
                        className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-black shadow-sm transition-colors hover:bg-neutral-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <RotateCwIcon
                            className={cn(
                                "size-4 transition-transform duration-300",
                                side === "back" && "rotate-180",
                            )}
                        />
                    </button>
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        spacing={0}
                        value={fit.id}
                        onValueChange={(value) => value && update({ fit: value, size: "" })}
                        aria-label="Fit shown"
                        className="absolute top-3 left-3 bg-white text-black shadow-sm"
                    >
                        {jacket.fits.map((f) => (
                            <ToggleGroupItem key={f.id} value={f.id} className={PHOTO_CHIP}>
                                {f.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
                <CardHeader>
                    <CardTitle className="text-2xl">{jacket.name}</CardTitle>
                    <CardDescription>
                        {jacket.maker} {jacket.model}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <p className="text-sm">
                        We&apos;re thinking of buying soft shell jackets for the team. Would you use
                        one? Tell us, and your size if so.
                    </p>
                    <ul className="flex flex-col gap-1.5 text-sm">
                        {jacket.features.map((feature) => (
                            <li key={feature} className="flex gap-2">
                                <CheckIcon className="mt-0.5 size-4 shrink-0 text-success-foreground" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sizes</CardTitle>
                    <CardDescription>
                        Measure a jacket that fits you well, flat across the chest, and compare with
                        the half-chest.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SizeChart
                        fits={jacket.fits}
                        collapsible={false}
                        selected={answer.size ? { fitId: fit.id, size: answer.size } : null}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
                        <ChoiceChips
                            label="Team"
                            options={JACKET_TEAMS.map((team) => ({ value: team, label: team }))}
                            value={answer.team ?? ""}
                            onChange={(team) =>
                                update({ team: team === "" ? null : (team as JacketTeam) })
                            }
                            error={errors.team}
                        />
                        <TextField
                            id={`${formId}-name`}
                            label="Name"
                            value={answer.name}
                            onChange={(name) => update({ name })}
                            placeholder="Your name"
                            error={errors.name}
                            maxLength={JACKET_NAME_MAX}
                        />
                        <ChoiceChips
                            label="Would you use one?"
                            options={JACKET_INTEREST_CHOICES.map((value) => ({
                                value,
                                label: INTEREST_LABELS[value],
                            }))}
                            value={answer.interest ?? ""}
                            onChange={(interest) =>
                                update({
                                    interest: interest === "" ? null : (interest as Interest),
                                    size: "",
                                })
                            }
                            error={errors.interest}
                        />
                        {answer.interest === "yes" && (
                            <>
                                <ChoiceChips
                                    label="Fit"
                                    options={jacket.fits.map((f) => ({
                                        value: f.id,
                                        label: f.label,
                                    }))}
                                    value={answer.fit}
                                    onChange={(value) => value && update({ fit: value, size: "" })}
                                    error={errors.fit}
                                />
                                <ChoiceChips
                                    label="Your size"
                                    options={fit.sizes.map(({ size }) => ({
                                        value: size,
                                        label: size,
                                    }))}
                                    value={answer.size}
                                    onChange={(size) => update({ size })}
                                    error={errors.size}
                                />
                            </>
                        )}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`${formId}-notes`}>Comments</Label>
                            <Textarea
                                id={`${formId}-notes`}
                                value={answer.notes}
                                onChange={(event) => update({ notes: event.target.value })}
                                placeholder="Anything we should know"
                                maxLength={JACKET_NOTES_MAX}
                                rows={3}
                            />
                        </div>
                        {/* Honeypot: hidden from people (and screen readers); bots fill it in. */}
                        <div
                            aria-hidden
                            className="absolute -left-[9999px] h-px w-px overflow-hidden"
                        >
                            <label htmlFor={`${formId}-website`}>Website</label>
                            <input
                                id={`${formId}-website`}
                                tabIndex={-1}
                                autoComplete="off"
                                value={honeypot}
                                onChange={(event) => setHoneypot(event.target.value)}
                            />
                        </div>
                        {submit.isError && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {submit.error.message ||
                                        "Your answer couldn't be sent. Please try again."}
                                </AlertDescription>
                            </Alert>
                        )}
                        <Button
                            type="submit"
                            size="lg"
                            className="self-stretch"
                            disabled={submit.isPending}
                        >
                            {submit.isPending ? "Sending…" : "Send"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
