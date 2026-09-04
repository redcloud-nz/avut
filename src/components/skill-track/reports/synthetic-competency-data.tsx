/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Development-only synthetic data for the skill-track reports. Reports are hard to eyeball without
 * a long history of real checks, so the report pages accept a `?synthetic` search param that swaps
 * the competencies from the server for a generated set driven by the controls in this file.
 */

"use client";

import { useMemo, useState, type ReactNode } from "react";

import { useQueryState } from "nuqs";

import { DicesIcon, FlaskConicalIcon } from "lucide-react";

import { useOrganization } from "@/hooks/use-organization";
import { getEnabledSkillCheckResultOptions } from "@/lib/schemas/skill-check";

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

import { SKILL_CHECK_RESULT_VALUES, SkillCheckResultValue } from "@/lib/schemas/skill-check";
import { RouterOutput } from "@/trpc/client";

type CompetencyMatrix = RouterOutput["skillChecks"]["getCompetencyMatrix"];
type MatrixSkill = CompetencyMatrix["skills"][number];
type Competency = CompetencyMatrix["competencies"][number];

export type SyntheticConfig = {
    /** Percentage of skills that have been assessed at all. */
    coverage: number;
    /** Checks are spread evenly between now and this many months ago. */
    maxAgeMonths: number;
    /** Relative likelihood of each result. Normalised at generation time. */
    weights: Record<SkillCheckResultValue, number>;
    /** Changing this reshuffles the generated data without changing the distribution. */
    seed: number;
};

export const DEFAULT_SYNTHETIC_CONFIG: SyntheticConfig = {
    coverage: 75,
    maxAgeMonths: 24,
    weights: {
        NotTaught: 5,
        LowFail: 0,
        Fail: 15,
        HighFail: 0,
        WeakPass: 0,
        Pass: 60,
        StrongPass: 20,
        Exempt: 0,
        Expired: 0,
        Provisional: 0,
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

    const totalWeight = SKILL_CHECK_RESULT_VALUES.reduce(
        (sum, result) => sum + config.weights[result],
        0,
    );

    return skills.flatMap((skill) => {
        const assessedRoll = random();
        const resultRoll = random();
        const ageRoll = random();

        if (assessedRoll * 100 >= config.coverage) return [];

        const result = totalWeight === 0 ? "Pass" : pickResult(resultRoll * totalWeight, config);

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

/**
 * Synthetic competencies for a whole personnel × skill matrix. Each person's slice is generated
 * by {@link generateSyntheticCompetencies} with a per-person seed offset, so the distribution
 * stays deterministic for a given config but doesn't come out identical for everyone.
 */
export function generateSyntheticMatrix(
    skills: MatrixSkill[],
    personnel: { id: Competency["assesseeId"] }[],
    config: SyntheticConfig,
): Competency[] {
    return personnel.flatMap((person) =>
        generateSyntheticCompetencies(skills, person.id, {
            ...config,
            seed: config.seed + hashString(person.id),
        }),
    );
}

/**
 * Wires the `?synthetic` search param into a report: when present, swaps the recorded
 * competencies for a generated matrix and returns the tuning dialog to drop into the report
 * header; when absent, passes the recorded competencies straight through and returns no dialog.
 */
export function useSyntheticCompetencies(
    skills: MatrixSkill[],
    personnel: { id: Competency["assesseeId"] }[],
    competencies: Competency[],
): { competencies: Competency[]; syntheticActions: ReactNode } {
    const organization = useOrganization();
    const [synthetic] = useQueryState("synthetic");
    const [config, setConfig] = useState(DEFAULT_SYNTHETIC_CONFIG);
    const isSynthetic = synthetic !== null;

    const generated = useMemo(
        () => (isSynthetic ? generateSyntheticMatrix(skills, personnel, config) : null),
        [isSynthetic, skills, personnel, config],
    );

    if (!isSynthetic || !generated) {
        return { competencies, syntheticActions: null };
    }

    return {
        competencies: generated,
        syntheticActions: (
            <SyntheticDataDialog
                config={config}
                onConfigChange={setConfig}
                resultOptions={getEnabledSkillCheckResultOptions(organization.settings)}
            />
        ),
    };
}

/** Cheap deterministic string hash (djb2), for deriving a per-person seed offset. */
function hashString(value: string): number {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function pickResult(roll: number, config: SyntheticConfig): SkillCheckResultValue {
    let remaining = roll;
    for (const result of SKILL_CHECK_RESULT_VALUES) {
        remaining -= config.weights[result];
        if (remaining < 0) return result;
    }
    return SKILL_CHECK_RESULT_VALUES[SKILL_CHECK_RESULT_VALUES.length - 1];
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
    resultOptions,
}: {
    config: SyntheticConfig;
    onConfigChange: (config: SyntheticConfig) => void;
    /** The org's enabled result values, in fixed order, with their configured labels. */
    resultOptions: { value: SkillCheckResultValue; label: string }[];
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

                    {resultOptions.map(({ value, label }) => (
                        <Field key={value}>
                            <FieldLabel>
                                {label} — {config.weights[value]}
                            </FieldLabel>
                            <Slider
                                value={[config.weights[value]]}
                                min={0}
                                max={100}
                                step={5}
                                onValueChange={([weight]) =>
                                    onConfigChange({
                                        ...config,
                                        weights: { ...config.weights, [value]: weight },
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
