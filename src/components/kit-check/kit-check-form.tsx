/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { PlusIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { ChoiceChips, TextField } from "@/components/forms/form-fields";
import { SizeChart } from "@/components/forms/size-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    NOT_NEEDED,
    OTHER_VARIANT,
    type HaveAnswer,
    type KitCheckAnswer,
    type KitCheckExtraItem,
    type KitCheckHeldItem,
    type KitCheckProposal,
    type KitCheckProposalAnswer,
    type KitCheckResponse,
    type KitCheckSubject,
    type KitCheckTemplate,
} from "@/lib/kit-check-types";
import {
    answerErrors,
    ANY_VARIANT,
    EMPTY_ANSWER,
    EMPTY_PROPOSAL_ANSWER,
    proposalErrors,
    proposalFit,
    visibleFields,
    type KitCheckField,
} from "@/lib/kit-check-validate";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<KitCheckField, string>>;

const PROBLEM_LABELS = {
    serial: "No serial number on our records",
    variant: "No brand or model on our records",
} as const;

/**
 * The member's side of a kit check, in two parts: the items D4H records as issued to them, and the
 * bundle's items D4H has nothing for. Each asks Have it (Yes, No or Not sure). Yes asks for whatever the record
 * lacks (serial, which variant) and offers a replacement; No asks which variant they want. Then
 * free rows for anything not on the list. Every visible question must be answered to submit.
 *
 * Uncontrolled, but seedable and observable: `initialResponse` sets where it starts (a saved
 * draft), and `onChange` hears the whole response after every edit (to autosave it).
 */
export function KitCheck_Form({
    subject,
    templates,
    heldItems,
    proposals = [],
    initialResponse,
    onChange,
    onSubmit,
    submitting = false,
    footer,
    notice,
}: {
    subject: KitCheckSubject;
    templates: KitCheckTemplate[];
    heldItems: KitCheckHeldItem[];
    /** Items the team is considering, to gauge interest. */
    proposals?: KitCheckProposal[];
    /** The answers to start from. Read once, on mount. */
    initialResponse?: KitCheckResponse;
    /** Called with the whole response after every edit. */
    onChange?: (response: KitCheckResponse) => void;
    onSubmit: (response: KitCheckResponse) => void;
    /** Disables the submit button while a submit is in flight. */
    submitting?: boolean;
    /** Shown in the sticky bar beside the submit button (e.g. the save status). */
    footer?: React.ReactNode;
    /** A last line in the intro card (e.g. that answers save as you go). */
    notice?: React.ReactNode;
}) {
    const [response, setResponse] = useState<KitCheckResponse>(
        () => initialResponse ?? { held: {}, missing: {}, extras: [], comments: "", proposals: {} },
    );
    const { held, missing, extras, comments } = response;
    const proposalAnswers = response.proposals ?? {};
    const [showErrors, setShowErrors] = useState(false);
    const formId = useId();
    // Extra rows are form-local, never records: a counter is enough to key them. It starts past
    // any numeric ids a saved draft already holds.
    const [firstExtraId] = useState(() => {
        const used = extras.map((extra) => Number(extra.id)).filter(Number.isInteger);
        return Math.max(-1, ...used) + 1;
    });
    const nextExtraId = useRef(firstExtraId);

    const update = (change: (prev: KitCheckResponse) => KitCheckResponse) => {
        const next = change(response);
        setResponse(next);
        onChange?.(next);
    };
    const setHeld = (
        change: (prev: Record<string, KitCheckAnswer>) => Record<string, KitCheckAnswer>,
    ) => update((prev) => ({ ...prev, held: change(prev.held) }));
    const setMissing = (
        change: (prev: Record<string, KitCheckAnswer>) => Record<string, KitCheckAnswer>,
    ) => update((prev) => ({ ...prev, missing: change(prev.missing) }));
    const setProposalAnswers = (
        change: (
            prev: Record<string, KitCheckProposalAnswer>,
        ) => Record<string, KitCheckProposalAnswer>,
    ) => update((prev) => ({ ...prev, proposals: change(prev.proposals ?? {}) }));
    const setExtras = (change: (prev: KitCheckExtraItem[]) => KitCheckExtraItem[]) =>
        update((prev) => ({ ...prev, extras: change(prev.extras) }));
    const setComments = (value: string) => update((prev) => ({ ...prev, comments: value }));

    const templateById = new Map(templates.map((template) => [template.id, template]));
    const heldRows = heldItems.flatMap((item) => {
        const template = templateById.get(item.templateId);
        return template ? [{ item, template }] : [];
    });
    const heldTemplateIds = new Set(heldItems.map((item) => item.templateId));
    const missingTemplates = templates.filter((template) => !heldTemplateIds.has(template.id));

    const heldAnswer = (id: string) => held[id] ?? EMPTY_ANSWER;
    const missingAnswer = (id: string) => missing[id] ?? EMPTY_ANSWER;
    const proposalAnswer = (id: string) => proposalAnswers[id] ?? EMPTY_PROPOSAL_ANSWER;

    const requiredMissing = missingTemplates.filter((t) => !t.optional);
    const optionalMissing = missingTemplates.filter((t) => t.optional);

    // In the order the sections render, so a failed submit scrolls to the first gap on the page.
    const rows = [
        ...heldRows.map(({ item, template }) => ({
            key: `${formId}-held-${item.id}`,
            errors: answerErrors(heldAnswer(item.id), template, item),
        })),
        ...[...requiredMissing, ...optionalMissing].map((template) => ({
            key: `${formId}-missing-${template.id}`,
            errors: answerErrors(missingAnswer(template.id), template, null),
        })),
        ...proposals.map((proposal) => ({
            key: `${formId}-proposal-${proposal.id}`,
            errors: proposalErrors(proposalAnswer(proposal.id), proposal),
        })),
    ];
    // A card counts once everything it asks is answered, follow-ups included.
    const answeredCount = rows.filter((row) => Object.keys(row.errors).length === 0).length;

    const hasOptional = optionalMissing.length > 0;
    // Sections are numbered in order, skipping any that don't show.
    const sectionNumbers = (() => {
        let next = 2;
        const optional = hasOptional ? ++next : null;
        const considering = proposals.length > 0 ? ++next : null;
        return { optional, considering, anythingElse: next + 1 };
    })();

    const renderMissing = (template: KitCheckTemplate) => (
        <KitCheck_ItemCard
            key={template.id}
            idPrefix={`${formId}-missing-${template.id}`}
            template={template}
            held={null}
            answer={missingAnswer(template.id)}
            errors={showErrors ? answerErrors(missingAnswer(template.id), template, null) : {}}
            onChange={(patch) =>
                setMissing((prev) => ({
                    ...prev,
                    [template.id]: { ...missingAnswer(template.id), ...patch },
                }))
            }
        />
    );

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const firstInvalid = rows.find((row) => Object.keys(row.errors).length > 0);
        if (firstInvalid) {
            setShowErrors(true);
            document
                .getElementById(firstInvalid.key)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        onSubmit({
            held: Object.fromEntries(heldRows.map(({ item }) => [item.id, heldAnswer(item.id)])),
            missing: Object.fromEntries(missingTemplates.map((t) => [t.id, missingAnswer(t.id)])),
            proposals: Object.fromEntries(proposals.map((p) => [p.id, proposalAnswer(p.id)])),
            extras: extras.filter((extra) => extra.item.trim() !== ""),
            comments,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-12" noValidate>
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Equipment check</CardTitle>
                    <CardDescription>
                        {subject.teamName} · {subject.bundleName}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                    <p>Hi {subject.memberName},</p>
                    <p>
                        We&apos;re checking our equipment records against the kit each member
                        actually has. Please go through each part below: what our records (D4H) say
                        you have, the items everyone should have,{" "}
                        {hasOptional && "things only some members hold, "}
                        and anything else. Tell us what you need as you go.
                    </p>
                    <p className="text-muted-foreground">
                        It takes about 5 minutes. No login is needed: this link is just for you.
                        Your answers go to {subject.requestedBy}.
                    </p>
                    {notice && <p className="text-muted-foreground">{notice}</p>}
                </CardContent>
            </Card>

            <KitCheck_Section
                number={1}
                title="What D4H says you have"
                description="Items our records show as issued to you."
                empty="Our records show nothing issued to you."
            >
                {heldRows.map(({ item, template }) => (
                    <KitCheck_ItemCard
                        key={item.id}
                        idPrefix={`${formId}-held-${item.id}`}
                        template={template}
                        held={item}
                        answer={heldAnswer(item.id)}
                        errors={showErrors ? answerErrors(heldAnswer(item.id), template, item) : {}}
                        onChange={(patch) =>
                            setHeld((prev) => ({
                                ...prev,
                                [item.id]: { ...heldAnswer(item.id), ...patch },
                            }))
                        }
                    />
                ))}
            </KitCheck_Section>

            <KitCheck_Section
                number={2}
                title="What items you should have"
                description="Items on the kit list that our records don't show you as having."
                empty="Our records show you have everything on the kit list."
            >
                {requiredMissing.map(renderMissing)}
            </KitCheck_Section>

            {hasOptional && (
                <KitCheck_Section
                    number={sectionNumbers.optional ?? 3}
                    title="Things you might have"
                    description="Only some members hold these. Tell us if you have one."
                >
                    {optionalMissing.map(renderMissing)}
                </KitCheck_Section>
            )}

            {proposals.length > 0 && (
                <KitCheck_Section
                    number={sectionNumbers.considering ?? 3}
                    title="Something we're considering"
                    description="We're thinking of buying these for the team. Would you use one?"
                >
                    {proposals.map((proposal) => (
                        <KitCheck_ProposalCard
                            key={proposal.id}
                            idPrefix={`${formId}-proposal-${proposal.id}`}
                            proposal={proposal}
                            answer={proposalAnswer(proposal.id)}
                            errors={
                                showErrors
                                    ? proposalErrors(proposalAnswer(proposal.id), proposal)
                                    : {}
                            }
                            onChange={(patch) =>
                                setProposalAnswers((prev) => ({
                                    ...prev,
                                    [proposal.id]: { ...proposalAnswer(proposal.id), ...patch },
                                }))
                            }
                        />
                    ))}
                </KitCheck_Section>
            )}

            <KitCheck_Section
                number={sectionNumbers.anythingElse}
                title="Anything else"
                description="Team gear you have that isn't listed above, or something else you need."
            >
                <Card>
                    <CardContent className="flex flex-col gap-4">
                        {extras.map((extra) => (
                            <KitCheck_ExtraRow
                                key={extra.id}
                                idPrefix={`${formId}-extra-${extra.id}`}
                                extra={extra}
                                onChange={(patch) =>
                                    setExtras((prev) =>
                                        prev.map((e) =>
                                            e.id === extra.id ? { ...e, ...patch } : e,
                                        ),
                                    )
                                }
                                onRemove={() =>
                                    setExtras((prev) => prev.filter((e) => e.id !== extra.id))
                                }
                            />
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            className="self-start"
                            onClick={() =>
                                setExtras((prev) => [
                                    ...prev,
                                    {
                                        id: String(nextExtraId.current++),
                                        item: "",
                                        kind: null,
                                        size: "",
                                        notes: "",
                                    },
                                ])
                            }
                        >
                            <PlusIcon /> Add an item
                        </Button>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor={`${formId}-comments`}>Other comments</Label>
                            <Textarea
                                id={`${formId}-comments`}
                                value={comments}
                                onChange={(event) => setComments(event.target.value)}
                                placeholder="Anything else we should know"
                            />
                        </div>
                    </CardContent>
                </Card>
            </KitCheck_Section>

            <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-4 border-t bg-background/95 px-4 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur">
                <span className="text-xs text-muted-foreground">
                    {answeredCount} of {rows.length}
                    {/* Dropped on narrow phones (320 px), where the bar would crowd. */}
                    <span className="sr-only sm:not-sr-only"> answered</span>
                </span>
                <div className="flex items-center gap-3">
                    {footer}
                    <Button type="submit" size="sm" disabled={submitting}>
                        {submitting ? "Sending…" : "Send my answers"}
                    </Button>
                </div>
            </div>
        </form>
    );
}

function KitCheck_Section({
    number,
    title,
    description,
    empty,
    children,
}: {
    number: number;
    title: string;
    description: string;
    empty?: string;
    children: React.ReactNode[] | React.ReactNode;
}) {
    const isEmpty = Array.isArray(children) && children.length === 0;
    return (
        <section className="flex flex-col gap-3">
            <div className="flex gap-3 px-1">
                <span
                    aria-hidden
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                    {number}
                </span>
                <div>
                    <h2 className="text-lg font-semibold">
                        <span className="sr-only">{number}. </span>
                        {title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </div>
            {isEmpty && empty ? (
                <p className="px-1 text-sm text-muted-foreground italic">{empty}</p>
            ) : (
                children
            )}
        </section>
    );
}

/**
 * The words every variant label starts with, when there are several and each has more after them:
 * "Protex NZRT Overall" for "Protex NZRT Overall 4" … "Protex NZRT Overall 12". The chips then
 * show only what differs (usually the size).
 */
export function commonVariantPrefix(labels: string[]): string {
    if (labels.length < 2) return "";
    const split = labels.map((label) => label.split(/\s+/));
    const shortest = Math.min(...split.map((words) => words.length));
    let count = 0;
    while (count < shortest - 1 && split.every((words) => words[count] === split[0][count]))
        count++;
    return split[0].slice(0, count).join(" ");
}

/** A chip's text: the label after the shared prefix, without a leading dash or wrapping parens. */
function chipText(label: string, prefix: string): string {
    const rest = (prefix ? label.slice(prefix.length) : label).trim().replace(/^[-–:]\s*/, "");
    return rest.replace(/^\((.*)\)$/, "$1");
}

function variantOptions(template: KitCheckTemplate) {
    const prefix = commonVariantPrefix(template.variants.map((variant) => variant.label));
    return [
        ...template.variants.map((variant) => ({
            value: variant.id,
            label: chipText(variant.label, prefix),
        })),
        { value: OTHER_VARIANT, label: "Other" },
    ];
}

/**
 * "Which one do you have?", naming the shared part of the variant labels when it says something
 * ("Protex NZRT Jacket", not "Generic" or a trailing dash).
 */
function variantQuestion(template: KitCheckTemplate, question: string): string {
    const prefix = commonVariantPrefix(template.variants.map((variant) => variant.label))
        .replace(/[\s\-–:]+$/, "")
        .trim();
    return prefix && prefix.toLowerCase() !== "generic" ? `${question} (${prefix})` : question;
}

/**
 * The line under a recorded item's name: its brand/model and serial. The description is left out
 * when it only repeats the item's name (a record with no brand or model).
 */
function heldDetail(held: KitCheckHeldItem, template: KitCheckTemplate): string {
    const description =
        held.description.trim().toLowerCase() === template.name.trim().toLowerCase()
            ? ""
            : held.description;
    return [description, held.serial && `S/N ${held.serial}`].filter(Boolean).join(" · ");
}

function KitCheck_ItemCard({
    idPrefix,
    template,
    held,
    answer,
    errors,
    onChange,
}: {
    idPrefix: string;
    template: KitCheckTemplate;
    /** The D4H record, or `null` for a kit-list item D4H has nothing for. */
    held: KitCheckHeldItem | null;
    answer: KitCheckAnswer;
    errors: Errors;
    onChange: (patch: Partial<KitCheckAnswer>) => void;
}) {
    const visible = visibleFields(answer, template, held);
    const hasError = Object.keys(errors).length > 0;

    const wantOptions =
        template.variants.length > 0
            ? variantOptions(template)
            : [{ value: ANY_VARIANT, label: "I need one" }];
    if (answer.has === "no") wantOptions.push({ value: NOT_NEEDED, label: "I don't need one" });

    const otherPicked =
        answer.variantId === OTHER_VARIANT || answer.wantVariantId === OTHER_VARIANT;

    return (
        <Card id={idPrefix} className={cn("scroll-mt-4", hasError && "border-destructive/60")}>
            <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <h3 className="font-semibold">{template.name}</h3>
                        <span className="text-xs text-muted-foreground">{template.category}</span>
                    </div>
                    {held && heldDetail(held, template) && (
                        <p className="text-sm text-muted-foreground">
                            {heldDetail(held, template)}
                        </p>
                    )}
                    {held?.problems.map((problem) => (
                        <Badge key={problem} variant="warning-outline" className="mt-1">
                            {PROBLEM_LABELS[problem]}
                        </Badge>
                    ))}
                </div>

                <ChoiceChips
                    label={held ? "Do you still have this?" : "Do you have one?"}
                    options={[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
                        { value: "unsure", label: "Not sure" },
                        ...(template.allowOwn ? [{ value: "own", label: "Using my own" }] : []),
                    ]}
                    value={answer.has ?? ""}
                    onChange={(has) =>
                        onChange({
                            ...EMPTY_ANSWER,
                            notes: answer.notes,
                            has: has === "" ? null : (has as HaveAnswer),
                        })
                    }
                    error={errors.has}
                />

                {visible.has("variantId") && (
                    <ChoiceChips
                        label={variantQuestion(template, "Which one do you have?")}
                        options={variantOptions(template)}
                        value={answer.variantId}
                        onChange={(variantId) => onChange({ variantId })}
                        error={errors.variantId}
                    />
                )}

                {visible.has("serial") && (
                    <TextField
                        id={`${idPrefix}-serial`}
                        label="Serial number"
                        value={answer.serial}
                        onChange={(serial) => onChange({ serial })}
                        placeholder="Usually on a label or stamped on the item"
                        error={errors.serial}
                    />
                )}

                {visible.has("replace") &&
                    (answer.replace ? (
                        <div className="flex flex-col gap-4 rounded-lg border border-dashed p-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">Replacement requested</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        onChange({
                                            replace: false,
                                            replaceWith: null,
                                            wantVariantId: "",
                                            size: "",
                                        })
                                    }
                                >
                                    <XIcon /> Cancel
                                </Button>
                            </div>
                            {visible.has("replaceWith") && (
                                <ChoiceChips
                                    label="Same as you have, or a different one?"
                                    options={[
                                        { value: "same", label: "The same" },
                                        { value: "different", label: "A different one" },
                                    ]}
                                    value={answer.replaceWith ?? ""}
                                    onChange={(replaceWith) =>
                                        onChange({
                                            replaceWith:
                                                replaceWith === ""
                                                    ? null
                                                    : (replaceWith as "same" | "different"),
                                            wantVariantId: "",
                                        })
                                    }
                                    error={errors.replaceWith}
                                />
                            )}
                            {visible.has("wantVariantId") && (
                                <ChoiceChips
                                    label={variantQuestion(template, "Which one would you like?")}
                                    options={variantOptions(template)}
                                    value={answer.wantVariantId}
                                    onChange={(wantVariantId) => onChange({ wantVariantId })}
                                    error={errors.wantVariantId}
                                />
                            )}
                            {visible.has("size") && (
                                <SizeField
                                    id={`${idPrefix}-size`}
                                    template={template}
                                    value={answer.size}
                                    onChange={(size) => onChange({ size })}
                                    error={errors.size}
                                />
                            )}
                        </div>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            className="self-start"
                            onClick={() => onChange({ replace: true })}
                        >
                            <RefreshCwIcon /> Need a replacement
                        </Button>
                    ))}

                {answer.has === "no" && visible.has("wantVariantId") && (
                    <>
                        <ChoiceChips
                            label={
                                template.variants.length > 0
                                    ? variantQuestion(template, "Which one would you like?")
                                    : "Do you need one?"
                            }
                            options={wantOptions}
                            value={answer.wantVariantId}
                            onChange={(wantVariantId) => onChange({ wantVariantId, size: "" })}
                            error={errors.wantVariantId}
                        />
                        {visible.has("size") && (
                            <SizeField
                                id={`${idPrefix}-size`}
                                template={template}
                                value={answer.size}
                                onChange={(size) => onChange({ size })}
                                error={errors.size}
                            />
                        )}
                    </>
                )}

                <TextField
                    id={`${idPrefix}-notes`}
                    label="Notes"
                    value={answer.notes}
                    onChange={(notes) => onChange({ notes })}
                    placeholder={
                        otherPicked
                            ? "Which one? Brand and model"
                            : answer.has === "own"
                              ? "What do you use? Brand, model"
                              : answer.has === "unsure"
                                ? "Why not sure? Anything you know helps"
                                : held && answer.has === "no"
                                  ? "What happened to it, if you know"
                                  : "Condition, or anything else"
                    }
                />
            </CardContent>
        </Card>
    );
}

function SizeField({
    id,
    template,
    value,
    onChange,
    error,
}: {
    id: string;
    template: KitCheckTemplate;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    const label = template.sizeOptional ? "Size (optional)" : "Size";
    if (template.sizeOptions.length === 0) {
        return (
            <TextField
                id={id}
                label={label}
                value={value}
                onChange={onChange}
                placeholder={template.sizeHint ?? "Your size"}
                error={error}
                className="max-w-56"
            />
        );
    }
    return (
        <ChoiceChips
            label={label}
            options={template.sizeOptions.map((size) => ({ value: size, label: size }))}
            value={value}
            onChange={onChange}
            error={error}
        />
    );
}

function KitCheck_ProposalCard({
    idPrefix,
    proposal,
    answer,
    errors,
    onChange,
}: {
    idPrefix: string;
    proposal: KitCheckProposal;
    answer: KitCheckProposalAnswer;
    errors: { interest?: string; fit?: string; size?: string };
    onChange: (patch: Partial<KitCheckProposalAnswer>) => void;
}) {
    const hasError = Object.keys(errors).length > 0;
    const fit = proposalFit(answer, proposal);
    const chosen = fit?.sizes.find(({ size }) => size === answer.size);
    return (
        <Card id={idPrefix} className={cn("scroll-mt-4", hasError && "border-destructive/60")}>
            <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{proposal.name}</h3>
                    {proposal.description && (
                        <p className="text-sm text-muted-foreground">{proposal.description}</p>
                    )}
                </div>
                <SizeChart
                    fits={proposal.fits}
                    selected={fit && answer.size ? { fitId: fit.id, size: answer.size } : null}
                />
                <ChoiceChips
                    label="Would you use one?"
                    options={[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
                        { value: "unsure", label: "Not sure" },
                    ]}
                    value={answer.interest ?? ""}
                    onChange={(interest) =>
                        onChange({
                            interest:
                                interest === ""
                                    ? null
                                    : (interest as KitCheckProposalAnswer["interest"]),
                            fit: "",
                            size: "",
                        })
                    }
                    error={errors.interest}
                />
                {answer.interest === "yes" && proposal.fits.length > 1 && (
                    <ChoiceChips
                        label="Fit"
                        options={proposal.fits.map((f) => ({ value: f.id, label: f.label }))}
                        value={answer.fit}
                        onChange={(fit) => onChange({ fit, size: "" })}
                        error={errors.fit}
                    />
                )}
                {answer.interest === "yes" && fit && fit.sizes.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <ChoiceChips
                            label="Your size"
                            options={fit.sizes.map(({ size }) => ({ value: size, label: size }))}
                            value={answer.size}
                            onChange={(size) => onChange({ size })}
                            error={errors.size}
                        />
                        {chosen?.halfChestCm !== undefined && (
                            <span className="text-sm text-muted-foreground">
                                {fit.label} {chosen.size}: garment half-chest {chosen.halfChestCm}{" "}
                                cm (full chest about {chosen.halfChestCm * 2} cm)
                            </span>
                        )}
                    </div>
                )}
                <TextField
                    id={`${idPrefix}-notes`}
                    label="Comments"
                    value={answer.notes}
                    onChange={(notes) => onChange({ notes })}
                    placeholder="Anything we should know"
                />
            </CardContent>
        </Card>
    );
}

function KitCheck_ExtraRow({
    idPrefix,
    extra,
    onChange,
    onRemove,
}: {
    idPrefix: string;
    extra: KitCheckExtraItem;
    onChange: (patch: Partial<KitCheckExtraItem>) => void;
    onRemove: () => void;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor={`${idPrefix}-item`}>Item</Label>
                    <Input
                        id={`${idPrefix}-item`}
                        value={extra.item}
                        onChange={(event) => onChange({ item: event.target.value })}
                        placeholder="e.g. Rescue knife"
                    />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
                    <Trash2Icon />
                    <span className="sr-only">Remove</span>
                </Button>
            </div>
            <ToggleGroup
                type="single"
                variant="outline"
                spacing={0}
                value={extra.kind ?? ""}
                onValueChange={(kind) =>
                    onChange({ kind: kind === "" ? null : (kind as "have" | "need") })
                }
                aria-label="Have or need"
            >
                <ToggleGroupItem value="have" className="px-4">
                    I have this
                </ToggleGroupItem>
                <ToggleGroupItem value="need" className="px-4">
                    I need this
                </ToggleGroupItem>
            </ToggleGroup>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
                <Input
                    value={extra.size}
                    onChange={(event) => onChange({ size: event.target.value })}
                    placeholder="Size (if any)"
                    aria-label="Size"
                />
                <Input
                    value={extra.notes}
                    onChange={(event) => onChange({ notes: event.target.value })}
                    placeholder="Serial number / notes"
                    aria-label="Serial number / notes"
                />
            </div>
        </div>
    );
}
