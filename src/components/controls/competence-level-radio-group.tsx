/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, useId } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import {
    CompetenceLevel,
    CompetenceLevels,
    CompetenceLevelTerms,
} from "@/lib/competencies";
import { Label } from "../ui/label";
import {
    SkillCheckCompetentIcon,
    SkillCheckHighlyConfidentIcon,
    SkillCheckNotAssessedIcon,
    SkillCheckNotCompetentIcon,
    SkillCheckNotTaughtIcon,
} from "../icons";

type CompetenceLevelRadioGroupProps = Omit<
    ComponentProps<typeof RadioGroupPrimitive.Root>,
    "children" | "value"
> & {
    value: CompetenceLevel;
    prevValue: CompetenceLevel | null;
    orientation?: "horizontal" | "vertical";
};

export function CompetenceLevelRadioGroup({
    className,
    prevValue,
    orientation = "vertical",
    value,
    ...props
}: CompetenceLevelRadioGroupProps) {
    const id = useId();
    const idPrefix = `radio-group-${id}`;

    return (
        <RadioGroupPrimitive.Root
            data-component="CompetenceLevelRadioGroup"
            data-slot="radio-group"
            className={cn(
                orientation === "vertical" &&
                    "grid grid-cols-[auto_1fr] gap-2 items-center",
                orientation === "horizontal" &&
                    "grid grid-cols-5 w-40 px-1 gap-2 items-center md:w-50 md:gap-4 md:px-2",
                className,
            )}
            value={value}
            {...props}
        >
            {CompetenceLevels.map((level) => (
                <>
                    <CompetenceLevelRadioGroupItem
                        key={level}
                        id={`${idPrefix}-${level}`}
                        value={level}
                        diff={
                            value == level
                                ? prevValue == level
                                    ? "none"
                                    : "add"
                                : prevValue == level
                                  ? "remove"
                                  : "none"
                        }
                    />
                    {orientation === "vertical" && (
                        <Label
                            htmlFor={`${idPrefix}-${level}`}
                            className="self-center"
                        >
                            {CompetenceLevelTerms[level]}
                        </Label>
                    )}
                </>
            ))}
        </RadioGroupPrimitive.Root>
    );
}

export function CompetenceLevelRadioGroupItem({
    className,
    diff,
    value,
    ...props
}: Omit<
    ComponentProps<typeof RadioGroupPrimitive.Item>,
    "children" | "value"
> & { value: CompetenceLevel; diff: "add" | "remove" | "none" }) {
    return (
        <RadioGroupPrimitive.Item
            data-component="CompetenceLevelRadioGroupItem"
            data-slot="radio-group-item"
            data-value={value}
            value={value}
            className={cn(
                "border-input text-primary aspect-square size-6 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none",
                "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "not-focus-visible:hover:ring-ring/20 hover:ring-[3px]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "data-[state=unchecked]:text-zinc-100",
                "data-[state=checked]:border-zinc-500/50",
                diff == "add" && "ring-2 ring-offset-1 ring-green-500/25",
                diff == "remove" && "ring-2 ring-offset-1 ring-red-500/25",
                className,
            )}
            {...props}
        >
            <RadioGroupPrimitive.Indicator className="relative flex items-center justify-center">
                {value == "NotAssessed" && (
                    <SkillCheckNotAssessedIcon className="size-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-600/50" />
                )}
                {value == "NotTaught" && (
                    <SkillCheckNotTaughtIcon className="size-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-600/50" />
                )}
                {value == "NotCompetent" && (
                    <SkillCheckNotCompetentIcon className="size-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600/50" />
                )}
                {value == "Competent" && (
                    <SkillCheckCompetentIcon className="size-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-600/50" />
                )}
                {value == "HighlyConfident" && (
                    <SkillCheckHighlyConfidentIcon className="size-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600/50" />
                )}
            </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
    );
}
