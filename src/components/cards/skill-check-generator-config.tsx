/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

import { Separator } from "@/components/ui/separator";
import { CompetenceLevel, CompetenceLevels } from "@/lib/competencies";

type DateWeightKey = "Expired" | "RecentlyExpired" | "NearlyExpired" | "OK";

const DateWeightKeys = [
    "Expired",
    "RecentlyExpired",
    "NearlyExpired",
    "OK",
] as const;

export interface SkillCheckGeneratorConfigData {
    statusWeights: Record<CompetenceLevel, number>;
    dateWeights: Record<DateWeightKey, number>;
}

export function SkillCheckGeneratorConfig_Card({
    defaultValue,
    onApply,
    onClose,
}: {
    defaultValue: SkillCheckGeneratorConfigData;
    onApply: (data: SkillCheckGeneratorConfigData) => void;
    onClose: () => void;
}) {
    const [state, setState] = useState<
        SkillCheckGeneratorConfigData & {
            statusWeightsTotal: number;
            dateWeightsTotal: number;
        }
    >({
        ...defaultValue,
        statusWeightsTotal: CompetenceLevels.reduce(
            (total, level) => total + (defaultValue.statusWeights[level] || 0),
            0,
        ),
        dateWeightsTotal: DateWeightKeys.reduce(
            (total, key) => total + (defaultValue.dateWeights[key] || 0),
            0,
        ),
    });

    function handleSubmit() {
        onApply(state);
        onClose();
    }

    function handleCancel() {
        onClose();
    }

    function handleChangeStatusWeight(key: CompetenceLevel, value: number) {
        setState((prev) => ({
            ...prev,
            statusWeights: { ...prev.statusWeights, [key]: value },
            statusWeightsTotal: CompetenceLevels.reduce(
                (total, level) => total + (prev.statusWeights[level] || 0),
                0,
            ),
        }));
    }

    function handleChangeDateWeight(
        key: "Expired" | "RecentlyExpired" | "NearlyExpired" | "OK",
        value: number,
    ) {
        setState((prev) => ({
            ...prev,
            dateWeights: { ...prev.dateWeights, [key]: value },
            dateWeightsTotal: DateWeightKeys.reduce(
                (total, k) => total + (prev.dateWeights[k] || 0),
                0,
            ),
        }));
    }

    return (
        <Card className="border-pink-200">
            <CardHeader>
                <CardTitle>Skill Check Generator Configuration</CardTitle>

                <Separator orientation="vertical" />
                {/* <CardExplanation>
                    <p>
                        This card allows you to adjust the probabilities for
                        each competence level and date ranges used for the
                        randomly generated skills checks.
                    </p>
                    The date probabilities are defined as follows:
                    <ul className="list-disc pl-6">
                        <li>
                            <span className="font-semibold">Expired</span> - A
                            date between 24 and 15 months ago.
                        </li>
                        <li>
                            <span className="font-semibold">
                                RecentlyExpired
                            </span>{" "}
                            - A date between 15 and 12 months ago.
                        </li>
                        <li>
                            <span className="font-semibold">NearlyExpired</span>{" "}
                            - A date between 12 and 9 months ago.
                        </li>
                        <li>
                            <span className="font-semibold">OK</span> - A date
                            between 9 and 0 months ago.
                        </li>
                    </ul>
                </CardExplanation> */}
            </CardHeader>
            <CardContent className="text-sm">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 items-start">
                    <div className="grid grid-cols-[auto_1fr_auto]">
                        <div className="pt-1 col-span-3 text-center font-bold">
                            Status Probabilities
                        </div>
                        {CompetenceLevels.map((level) => (
                            <div
                                key={level}
                                className="h-6 col-span-3 grid grid-cols-subgrid items-center gap-2"
                            >
                                <div className="pl-2 text-right">{level}</div>
                                <Slider
                                    value={[state.statusWeights[level]]}
                                    onValueChange={(values) =>
                                        handleChangeStatusWeight(
                                            level,
                                            values[0],
                                        )
                                    }
                                    min={0}
                                    max={100}
                                    step={0.1}
                                />
                                <div className="px-2 text-right font-mono">
                                    {(
                                        (state.statusWeights[level] /
                                            state.statusWeightsTotal) *
                                        100
                                    ).toFixed(1)}
                                    %
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-[auto_1fr_auto]">
                        <div className="pt-1 col-span-3 text-center font-bold">
                            Date Probabilities
                        </div>
                        {DateWeightKeys.map((key) => (
                            <div
                                key={key}
                                className="h-6 col-span-3 grid grid-cols-subgrid items-center gap-2"
                            >
                                <div className="pl-2 text-right">{key}</div>
                                <Slider
                                    value={[state.dateWeights[key]]}
                                    onValueChange={(values) =>
                                        handleChangeDateWeight(key, values[0])
                                    }
                                    min={0}
                                    max={100}
                                    step={0.1}
                                />
                                <div className="px-2 text-right font-mono">
                                    {(
                                        (state.dateWeights[key] /
                                            state.dateWeightsTotal) *
                                        100
                                    ).toFixed(1)}
                                    %
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-2 pt-1 flex gap-2 border-t">
                    <Button size="sm" onClick={handleSubmit}>
                        Apply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancel}>
                        Cancel
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
