/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import {
    ChevronDownIcon,
    ChevronUpIcon,
    MessageSquarePlusIcon,
    MoreVerticalIcon,
} from "lucide-react";
import { useState } from "react";

import { ObjectIcons, SkillsIcons } from "@/components/icons";
import { Show } from "@/components/show";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

import { SkillCheckResultValue } from "@/lib/schemas/skill-check";

const FAIL_TIERS: readonly SkillCheckResultValue[] = ["LowFail", "Fail", "HighFail"];
const PASS_TIERS: readonly SkillCheckResultValue[] = ["WeakPass", "Pass", "StrongPass"];

/** Distinct icon + color per exact result value, so tiers within a family read at a glance. */
const RESULT_ICONS: Record<
    SkillCheckResultValue,
    { Icon: typeof SkillsIcons.Pass; className: string }
> = {
    NotTaught: { Icon: SkillsIcons.NotTaught, className: "text-gray-500" },
    LowFail: { Icon: SkillsIcons.LowFail, className: "text-red-500" },
    Fail: { Icon: SkillsIcons.Fail, className: "text-orange-500" },
    HighFail: { Icon: SkillsIcons.HighFail, className: "text-gray-400" },
    WeakPass: { Icon: SkillsIcons.WeakPass, className: "text-gray-400" },
    Pass: { Icon: SkillsIcons.Pass, className: "text-green-500" },
    StrongPass: { Icon: SkillsIcons.StrongPass, className: "text-blue-500" },
    Exempt: { Icon: SkillsIcons.NotTaught, className: "text-gray-500" },
    Expired: { Icon: SkillsIcons.NotTaught, className: "text-gray-500" },
    Provisional: { Icon: SkillsIcons.NotTaught, className: "text-gray-500" },
};

/**
 * The next tier to land on when clicking a family's cycle button — advances to the next
 * enabled tier if already within the family, otherwise jumps to the mid tier (or the first
 * enabled tier, if mid isn't enabled for this organization).
 */
function nextTier(
    current: SkillCheckResultValue | null,
    tiers: readonly SkillCheckResultValue[],
    enabled: Set<SkillCheckResultValue>,
    mid: SkillCheckResultValue,
): SkillCheckResultValue {
    const enabledTiers = tiers.filter((tier) => enabled.has(tier));

    if (current && enabledTiers.includes(current)) {
        const index = enabledTiers.indexOf(current);
        return enabledTiers[(index + 1) % enabledTiers.length];
    }

    return enabledTiers.includes(mid) ? mid : enabledTiers[0];
}

interface AssessmentRowProps {
    title: string;
    description?: string;
    value: { result: SkillCheckResultValue | null; notes: string };
    onValueChange: (newValue: { result: SkillCheckResultValue | null; notes: string }) => void;
    /** The organization's enabled result values and their labels, in fixed order. */
    resultOptions: { value: SkillCheckResultValue; label: string }[];
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
    resultOptions,
}: AssessmentRowProps) {
    const [showNotes, setShowNotes] = useState(false);

    const enabled = new Set(resultOptions.map((option) => option.value));
    const failTiers = FAIL_TIERS.filter((tier) => enabled.has(tier));
    const passTiers = PASS_TIERS.filter((tier) => enabled.has(tier));

    // While a tier from the family is selected, the button shows that exact tier's icon/color.
    // Otherwise it previews the mid tier (or the first enabled tier) as a neutral default.
    const failPreview =
        value.result && failTiers.includes(value.result)
            ? value.result
            : (failTiers.find((tier) => tier === "Fail") ?? failTiers[0] ?? "Fail");
    const passPreview =
        value.result && passTiers.includes(value.result)
            ? value.result
            : (passTiers.find((tier) => tier === "Pass") ?? passTiers[0] ?? "Pass");

    // Values outside the fail/pass tiers (NotTaught, and — once enabled — Exempt/Expired/
    // Provisional) have no quick button; show the value's label instead, selectable only from
    // the dropdown.
    const isFailOrPassTier =
        value.result !== null &&
        (FAIL_TIERS.includes(value.result) || PASS_TIERS.includes(value.result));
    const otherLabel =
        value.result !== null && !isFailOrPassTier
            ? (resultOptions.find((option) => option.value === value.result)?.label ?? value.result)
            : null;

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

                <div className="flex items-center gap-1">
                    {otherLabel !== null ? (
                        <span className="px-1 text-sm whitespace-nowrap text-muted-foreground">
                            {otherLabel}
                        </span>
                    ) : (
                        <>
                            <Show when={failTiers.length > 0}>
                                <Button
                                    variant={
                                        value.result && failTiers.includes(value.result)
                                            ? "outline"
                                            : "ghost"
                                    }
                                    size="icon"
                                    aria-label="Not Yet Competent"
                                    onClick={() =>
                                        onValueChange({
                                            ...value,
                                            result: nextTier(
                                                value.result,
                                                FAIL_TIERS,
                                                enabled,
                                                "Fail",
                                            ),
                                        })
                                    }
                                >
                                    {(() => {
                                        const { Icon, className } = RESULT_ICONS[failPreview];
                                        return <Icon className={className} />;
                                    })()}
                                </Button>
                            </Show>

                            <Show when={passTiers.length > 0}>
                                <Button
                                    variant={
                                        value.result && passTiers.includes(value.result)
                                            ? "outline"
                                            : "ghost"
                                    }
                                    size="icon"
                                    aria-label="Competent"
                                    onClick={() =>
                                        onValueChange({
                                            ...value,
                                            result: nextTier(
                                                value.result,
                                                PASS_TIERS,
                                                enabled,
                                                "Pass",
                                            ),
                                        })
                                    }
                                >
                                    {(() => {
                                        const { Icon, className } = RESULT_ICONS[passPreview];
                                        return <Icon className={className} />;
                                    })()}
                                </Button>
                            </Show>
                        </>
                    )}

                    <Show when={value.result !== null} fallback={<div className="w-8" />}>
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Notes">
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

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="More result options">
                                <MoreVerticalIcon />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-max">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Result</DropdownMenuLabel>
                                {resultOptions.map((option) => {
                                    const { Icon, className } = RESULT_ICONS[option.value];
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={option.value}
                                            checked={option.value === value.result}
                                            onCheckedChange={() =>
                                                onValueChange({ ...value, result: option.value })
                                            }
                                        >
                                            <Icon className={className} />
                                            {option.label}
                                        </DropdownMenuCheckboxItem>
                                    );
                                })}
                            </DropdownMenuGroup>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                disabled={value.result === null}
                                onClick={() => onValueChange({ result: null, notes: "" })}
                            >
                                <ObjectIcons.Delete />
                                Remove
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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
