/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ChevronDownIcon, ChevronUpIcon, MessageSquarePlusIcon } from "lucide-react";
import { useState } from "react";

import { SkillsIcons } from "@/components/icons";
import { Show } from "@/components/show";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { SkillCheckResultValue } from "@/lib/schemas/skill-check";

interface AssessmentRowProps {
    title: string;
    description?: string;
    value: { result: SkillCheckResultValue | null; notes: string };
    onValueChange: (newValue: { result: SkillCheckResultValue | null; notes: string }) => void;
}

/**
 * Row component for displaying and editing an assessment for a specific assessee/skill combination.
 * Allows selecting a result and adding optional notes.
 */
export function SkillTrack_AssessmentRow({
    title,
    description,
    value,
    onValueChange,
}: AssessmentRowProps) {
    const [showNotes, setShowNotes] = useState(false);

    return (
        <Collapsible className="flex flex-col gap-2" open={showNotes} onOpenChange={setShowNotes}>
            <div className="flex items-center gap-2">
                {description ? (
                    <FieldContent className="grow">
                        <FieldLabel>{title}</FieldLabel>
                        <FieldDescription>{description}</FieldDescription>
                    </FieldContent>
                ) : (
                    <FieldLabel className="grow">{title}</FieldLabel>
                )}

                <div className="flex gap-2">
                    <ToggleGroup
                        type="single"
                        className="gap-0"
                        value={value.result ?? ""}
                        onValueChange={(newValue) => {
                            if (newValue === "") {
                                onValueChange({ result: null, notes: "" });
                            } else {
                                onValueChange({
                                    ...value,
                                    result: newValue as SkillCheckResultValue,
                                });
                            }
                        }}
                    >
                        <ToggleGroupItem
                            value="NotTaught"
                            aria-label="Not Taught"
                            className="data-[state=on]:[&>_svg]:size-6 data-[state=on]:[&>_svg]:-m-1"
                        >
                            <SkillsIcons.NotTaught className="text-gray-500" />
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="Fail"
                            aria-label="Not Yet Competent"
                            className="data-[state=on]:[&>_svg]:size-6 data-[state=on]:[&>_svg]:-m-1"
                        >
                            <SkillsIcons.Fail className="text-orange-500" />
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="Pass"
                            aria-label="Competent"
                            className="data-[state=on]:[&>_svg]:size-6 data-[state=on]:[&>_svg]:-m-1"
                        >
                            <SkillsIcons.Pass className="text-green-500" />
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="StrongPass"
                            aria-label="Highly Confident"
                            className="data-[state=on]:[&>_svg]:size-6 data-[state=on]:[&>_svg]:-m-1"
                        >
                            <SkillsIcons.StrongPass className="text-blue-500" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <Show when={value.result !== null} fallback={<div className="w-8" />}>
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon">
                                {showNotes ? (
                                    <ChevronUpIcon />
                                ) : value.notes ? (
                                    <ChevronDownIcon />
                                ) : (
                                    <MessageSquarePlusIcon />
                                )}
                            </Button>
                        </CollapsibleTrigger>
                    </Show>

                    {/* <Show
                        when={value.result !== "NotAssessed"}
                        fallback={<div className="w-[38px]" />}
                    >
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Toggle
                                    variant="outline"
                                    pressed={showNotes}
                                    onPressedChange={setShowNotes}
                                    disabled={!!value.notes}
                                >
                                    <MessageSquareIcon className="group-data-[state=on]/toggle:fill-foreground" />
                                </Toggle>
                            </TooltipTrigger>
                            <TooltipContent>Add notes to assessment</TooltipContent>
                        </Tooltip>
                    </Show> */}
                </div>
            </div>
            <CollapsibleContent>
                <Textarea
                    className="w-full col-span-full"
                    placeholder="Notes..."
                    value={value.notes}
                    onChange={(e) => onValueChange({ ...value, notes: e.target.value })}
                />
            </CollapsibleContent>
        </Collapsible>
    );
}
