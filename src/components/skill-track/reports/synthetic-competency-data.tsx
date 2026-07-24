/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Development-only synthetic data for the skill-track reports. Reports are hard to eyeball without
 * a long history of real checks, so the report pages accept a `?synthetic` search param that swaps
 * the competencies from the server for a generated set driven by the controls in this file.
 */

"use client";

import { DicesIcon, FlaskConicalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";

import { SKILL_CHECK_RESULT_LABELS } from "@/lib/schemas/skill-check";
import { RouterOutput } from "@/trpc/client";

type CompetencyMatrix = RouterOutput["skillChecks"]["getCompetencyMatrix"];
type MatrixSkill = CompetencyMatrix["skills"][number];
type Competency = CompetencyMatrix["competencies"][number];

/** The results a recorded check can hold — "NotAssessed" deletes a check rather than storing one. */
const SYNTHETIC_RESULTS = ["NotTaught", "NotYetCompetent", "Competent", "HighlyConfident"] as const;

type SyntheticResult = (typeof SYNTHETIC_RESULTS)[number];

export type SyntheticConfig = {
    /** Percentage of skills that have been assessed at all. */
    coverage: number;
    /** Checks are spread evenly between now and this many months ago. */
    maxAgeMonths: number;
    /** Relative likelihood of each result. Normalised at generation time. */
    weights: Record<SyntheticResult, number>;
    /** Changing this reshuffles the generated data without changing the distribution. */
    seed: number;
};

export const DEFAULT_SYNTHETIC_CONFIG: SyntheticConfig = {
    coverage: 75,
    maxAgeMonths: 24,
    weights: {
        NotTaught: 5,
        NotYetCompetent: 15,
        Competent: 60,
        HighlyConfident: 20,
    },
    seed: 1,
};

/**
 * Generates a competency per in-scope skill, matching the shape and the expiry arithmetic of
 * `skillChecks.getCompetencyMatrix`. Deterministic for a given config, so tweaking one slider
 * doesn't reshuffle everything else.
 */
export function generateSyntheticCompetencies(
    skills: MatrixSkill[],
    personId: Competency["assesseeId"],
    config: SyntheticConfig,
): Competency[] {
    const random = mulberry32(config.seed);
    const now = new Date();

    const totalWeight = SYNTHETIC_RESULTS.reduce((sum, result) => sum + config.weights[result], 0);

    return skills.flatMap((skill) => {
        const assessedRoll = random();
        const resultRoll = random();
        const ageRoll = random();

        if (assessedRoll * 100 >= config.coverage) return [];

        const result =
            totalWeight === 0 ? "Competent" : pickResult(resultRoll * totalWeight, config);

        const checkedAt = new Date(now);
        checkedAt.setDate(checkedAt.getDate() - Math.floor(ageRoll * config.maxAgeMonths * 30));

        const expiresAt = new Date(checkedAt);
        expiresAt.setMonth(expiresAt.getMonth() + skill.frequency);

        return [
            {
                assesseeId: personId,
                skillId: skill.id,
                checkId: `synthetic${skill.id}`.slice(0, 16) as Competency["checkId"],
                result,
                checkedAt: checkedAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
                isCurrent: expiresAt > now,
            },
        ];
    });
}

function pickResult(roll: number, config: SyntheticConfig): SyntheticResult {
    let remaining = roll;
    for (const result of SYNTHETIC_RESULTS) {
        remaining -= config.weights[result];
        if (remaining < 0) return result;
    }
    return SYNTHETIC_RESULTS[SYNTHETIC_RESULTS.length - 1];
}

/** Small seeded PRNG — we only need repeatable noise, not statistical rigour. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Trigger button plus the dialog that tunes the generated distribution. Lives in the report
 * header, where it doubles as the signal that the report is not showing recorded data.
 */
export function SyntheticDataDialog({
    config,
    onConfigChange,
}: {
    config: SyntheticConfig;
    onConfigChange: (config: SyntheticConfig) => void;
}) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <FlaskConicalIcon />
                    Synthetic Data
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Synthetic Data</DialogTitle>
                    <DialogDescription>
                        This report is generated from these settings, not from recorded skill
                        checks. Drop the <code>?synthetic</code> search param to see real data.
                    </DialogDescription>
                </DialogHeader>

                <FieldGroup>
                    <Field>
                        <FieldLabel>Assessed — {config.coverage}% of skills</FieldLabel>
                        <Slider
                            value={[config.coverage]}
                            min={0}
                            max={100}
                            step={5}
                            onValueChange={([coverage]) => onConfigChange({ ...config, coverage })}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>Spread over the last {config.maxAgeMonths} months</FieldLabel>
                        <Slider
                            value={[config.maxAgeMonths]}
                            min={1}
                            max={60}
                            step={1}
                            onValueChange={([maxAgeMonths]) =>
                                onConfigChange({ ...config, maxAgeMonths })
                            }
                        />
                    </Field>

                    {SYNTHETIC_RESULTS.map((result) => (
                        <Field key={result}>
                            <FieldLabel>
                                {SKILL_CHECK_RESULT_LABELS[result] ?? result} —{" "}
                                {config.weights[result]}
                            </FieldLabel>
                            <Slider
                                value={[config.weights[result]]}
                                min={0}
                                max={100}
                                step={5}
                                onValueChange={([weight]) =>
                                    onConfigChange({
                                        ...config,
                                        weights: { ...config.weights, [result]: weight },
                                    })
                                }
                            />
                        </Field>
                    ))}
                </FieldGroup>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onConfigChange({ ...config, seed: config.seed + 1 })}
                    >
                        <DicesIcon />
                        Reshuffle
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
