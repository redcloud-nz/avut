/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
    OTHER_VARIANT,
    type KitCheckAnswer,
    type KitCheckHeldItem,
    type KitCheckProposal,
    type KitCheckResponse,
    type KitCheckTemplate,
} from "./kit-check-types";
import { ANY_VARIANT, wantsOne } from "./kit-check-validate";

function variantLabel(template: KitCheckTemplate, variantId: string, notes: string): string {
    if (variantId === OTHER_VARIANT) return notes.trim() ? `Other: ${notes.trim()}` : "Other";
    if (variantId === ANY_VARIANT || variantId === "") return "Any";
    return template.variants.find((variant) => variant.id === variantId)?.label ?? variantId;
}

const INTEREST_LABELS = { yes: "Yes", no: "No", unsure: "Not sure" } as const;

/**
 * What a submitted kit check tells the equipment officer: what the member needs (the purchase
 * list) and how D4H's records should change.
 */
export function KitCheck_Summary({
    templates,
    heldItems,
    proposals = [],
    response,
    onRestart,
}: {
    templates: KitCheckTemplate[];
    heldItems: KitCheckHeldItem[];
    proposals?: KitCheckProposal[];
    response: KitCheckResponse;
    onRestart?: () => void;
}) {
    const templateById = new Map(templates.map((template) => [template.id, template]));

    type Row = {
        template: KitCheckTemplate;
        answer: KitCheckAnswer;
        held: KitCheckHeldItem | null;
    };
    const rows: Row[] = [
        ...heldItems.flatMap((held) => {
            const template = templateById.get(held.templateId);
            const answer = response.held[held.id];
            return template && answer ? [{ template, answer, held }] : [];
        }),
        ...Object.entries(response.missing).flatMap(([templateId, answer]) => {
            const template = templateById.get(templateId);
            return template ? [{ template, answer, held: null }] : [];
        }),
    ];

    const needs = [
        ...rows
            .filter(({ answer }) => wantsOne(answer))
            .map(({ template, answer, held }) => {
                const variantId =
                    answer.has === "yes" && answer.replaceWith === "same"
                        ? (held?.variantId ?? answer.variantId)
                        : answer.wantVariantId;
                return [
                    template.name,
                    variantLabel(template, variantId, answer.notes),
                    answer.size || "—",
                    answer.has === "yes" ? "Replacement" : "Doesn't have one",
                ];
            }),
        ...response.extras
            .filter((extra) => extra.kind === "need")
            .map((extra) => [extra.item, extra.notes || "—", extra.size || "—", "Not on the list"]),
    ];

    const changes = [
        ...rows.flatMap(({ template, answer, held }) => {
            if (held && answer.has === "no")
                return [[template.name, "Recorded, but not with them", answer.notes || "—"]];
            if (answer.has === "own")
                return [
                    [
                        template.name,
                        held ? "Uses their own instead" : "Uses their own",
                        answer.notes || "—",
                    ],
                ];
            if (answer.has !== "yes") return [];
            const details = [
                answer.variantId && variantLabel(template, answer.variantId, answer.notes),
                answer.serial.trim() && `S/N ${answer.serial.trim()}`,
            ].filter(Boolean);
            if (!held)
                return [[template.name, "Has one, not recorded", details.join(" · ") || "—"]];
            if (details.length > 0) return [[template.name, "Fill in record", details.join(" · ")]];
            return [];
        }),
        ...response.extras
            .filter((extra) => extra.kind === "have")
            .map((extra) => [extra.item, "Has one, not on the list", extra.notes || "—"]),
    ];

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Thanks, that&apos;s everything</CardTitle>
                    <CardDescription>
                        Below is what the equipment officer receives from your answers.
                    </CardDescription>
                </CardHeader>
            </Card>

            <SummaryTable
                title="Needs"
                empty="Nothing needed."
                headings={["Item", "Which", "Size", "Why"]}
                rows={needs}
            />
            <SummaryTable
                title="Changes to our records"
                empty="Everything matches our records."
                headings={["Item", "Change", "Details"]}
                rows={changes}
            />
            {proposals.length > 0 && (
                <SummaryTable
                    title="Interest"
                    empty=""
                    headings={["Item", "Would use one", "Size", "Comments"]}
                    rows={proposals.map((proposal) => {
                        const answer = response.proposals[proposal.id];
                        return [
                            proposal.name,
                            INTEREST_LABELS[answer?.interest ?? "unsure"],
                            answer?.size
                                ? [
                                      proposal.fits.length > 1 &&
                                          proposal.fits.find((f) => f.id === answer.fit)?.label,
                                      answer.size,
                                  ]
                                      .filter(Boolean)
                                      .join(" ")
                                : "—",
                            answer?.notes || "—",
                        ];
                    })}
                />
            )}
            {response.comments.trim() !== "" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Comments</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm whitespace-pre-wrap">
                        {response.comments}
                    </CardContent>
                </Card>
            )}
            {onRestart && (
                <Button variant="outline" className="self-start" onClick={onRestart}>
                    Start again
                </Button>
            )}
        </div>
    );
}

function SummaryTable({
    title,
    empty,
    headings,
    rows,
}: {
    title: string;
    empty: string;
    headings: string[];
    rows: string[][];
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{empty}</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left text-muted-foreground">
                                {headings.map((heading) => (
                                    <th key={heading} className="py-1.5 pr-3 font-medium">
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr key={index} className="border-b last:border-0">
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="py-1.5 pr-3 align-top">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </CardContent>
        </Card>
    );
}
