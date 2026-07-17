/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { MessageSquareIcon } from "lucide-react";
import { useState } from "react";

import { SkillsIcons } from "@/components/icons";
import { Field, FieldLabel } from "@/components/ui/field";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Show } from "@/components/show";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

interface AssessmentRowProps {
    title: string;
    value: { result: string; notes: string };
    onValueChange: (newValue: { result: string; notes: string }) => void;
}

/**
 * Row component for displaying and editing an assessment for a specific assessee/skill combination.
 * Allows selecting a result and adding optional notes.
 */
export function SkillTrack_AssessmentRow({ title, value, onValueChange }: AssessmentRowProps) {
    const [showNotes, setShowNotes] = useState(false);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <FieldLabel className="grow">{title}</FieldLabel>
                <div className="flex gap-2">
                    <ToggleGroup
                        type="single"
                        className="gap-0"
                        value={value.result === "NotAssessed" ? "" : value.result}
                        onValueChange={(newValue) => {
                            if (newValue === "") {
                                onValueChange({ result: "NotAssessed", notes: "" });
                            } else {
                                onValueChange({ ...value, result: newValue });
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
                            value="NotYetCompetent"
                            aria-label="Not Yet Competent"
                            className="data-[state=on]:[&>_svg]:size-6 data-[state=on]:[&>_svg]:-m-1"
                        >
                            <SkillsIcons.NotCompetent className="text-orange-500" />
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="Competent"
                            aria-label="Competent"
                            className="data-[state=on]:[&>_svg]:size-6 data-[state=on]:[&>_svg]:-m-1"
                        >
                            <SkillsIcons.Competent className="text-green-500" />
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="HighlyConfident"
                            aria-label="Highly Confident"
                            className="data-[state=on]:[&>_svg]:size-6 data-[state=on]:[&>_svg]:-m-1"
                        >
                            <SkillsIcons.HighlyConfident className="text-blue-500" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <Show
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
                    </Show>
                </div>
            </div>
            {(value.notes || showNotes) && (
                <Textarea
                    className="w-full col-span-full"
                    placeholder="Notes..."
                    value={value.notes}
                    onChange={(e) => onValueChange({ ...value, notes: e.target.value })}
                />
            )}
        </div>
    );
}
