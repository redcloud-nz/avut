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
        <>
            <Field>
                <FieldLabel>{title}</FieldLabel>
                <div className="flex gap-2 min-w-1/2">
                    <Select
                        value={value.result}
                        onValueChange={(newValue) => {
                            if (newValue === "NotAssessed") {
                                onValueChange({ result: newValue, notes: "" });
                            } else {
                                onValueChange({ ...value, result: newValue });
                            }
                        }}
                    >
                        <SelectTrigger className="grow">
                            <SelectValue placeholder="Not Assessed" />
                        </SelectTrigger>
                        <SelectContent position="item-aligned">
                            <SelectItem value="NotAssessed">
                                <SkillsIcons.NotAssessed className="text-gray-500" />
                                Not Assessed
                            </SelectItem>
                            <SelectSeparator />
                            <SelectItem value="NotTaught">
                                <SkillsIcons.NotTaught className="text-gray-500" /> Not Taught
                            </SelectItem>
                            <SelectItem value="NotYetCompetent">
                                <SkillsIcons.NotCompetent className="text-orange-500" /> Not Yet
                                Competent
                            </SelectItem>
                            <SelectItem value="Competent">
                                <SkillsIcons.Competent className="text-green-500" /> Competent
                            </SelectItem>
                            <SelectItem value="HighlyConfident">
                                <SkillsIcons.HighlyConfident className="text-blue-500" /> Highly
                                Confident
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Show
                        when={value.result !== "NotAssessed"}
                        fallback={<div className="w-[34px]" />}
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

                {(value.notes || showNotes) && (
                    <Textarea
                        className="w-full col-span-full"
                        placeholder="Notes..."
                        value={value.notes}
                        onChange={(e) => onValueChange({ ...value, notes: e.target.value })}
                    />
                )}
            </Field>
        </>
    );
}
