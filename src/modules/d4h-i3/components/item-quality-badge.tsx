/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { AlertWarningIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { missingPartsLabel, type ItemQualityResult } from "@/modules/d4h-i3/lib/item-quality";

const BADGE_CLASS =
    "border-amber-600/40 font-normal text-amber-700 dark:border-amber-500/40 dark:text-amber-500";

const MISMATCH_REASON: Record<NonNullable<ItemQualityResult["mismatch"]>, string> = {
    "not-a-variant": "This isn't one of the template's variants.",
    "should-be-blank": "This template expects no brand or model.",
};

/**
 * Flags an issued item that fails its template's data-quality checks: "Incomplete" items name the
 * blank parts ("No model"), and "Doesn't match" items explain why in a tooltip. Renders nothing for
 * an item that passes.
 */
export function D4HI3Module_ItemQuality_Badge({
    result,
    item,
}: {
    result: ItemQualityResult;
    item: { brand: { title?: string | null }; model: { title?: string | null } | null };
}) {
    if (result.state === "ok") return null;

    if (result.state === "incomplete") {
        return (
            <Badge variant="outline" className={BADGE_CLASS}>
                <AlertWarningIcon />
                {missingPartsLabel(result.missing)}
            </Badge>
        );
    }

    const brand = item.brand.title || "—";
    const model = item.model?.title || "—";
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge variant="outline" tabIndex={0} className={BADGE_CLASS}>
                    <AlertWarningIcon />
                    Doesn&apos;t match
                </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
                Brand: {brand}, Model: {model}.{" "}
                {result.mismatch ? MISMATCH_REASON[result.mismatch] : null}
            </TooltipContent>
        </Tooltip>
    );
}
