/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { AlertWarningIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const FLAG_LABEL = "Not organisation records";
const FLAG_HINT =
    "This template can only be issued to the D4H teams that own its records. Edit it to use the D4H organisation's records.";

/**
 * Flags a template that uses D4H records not owned by the linked D4H organisation, while the
 * "Organisation-owned records only" setting is on.
 */
export function D4HI3Module_OtherRecords_Badge() {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge
                    variant="outline"
                    tabIndex={0}
                    className="border-amber-600/40 font-normal text-amber-700 dark:border-amber-500/40 dark:text-amber-500"
                >
                    <AlertWarningIcon />
                    {FLAG_LABEL}
                </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{FLAG_HINT}</TooltipContent>
        </Tooltip>
    );
}

/** The same flag as a small icon, for a variant row. */
export function D4HI3Module_OtherRecords_Marker() {
    return (
        <span title={FLAG_LABEL} className="inline-flex align-middle">
            <AlertWarningIcon className="size-3.5 text-amber-600 dark:text-amber-500" />
            <span className="sr-only">{FLAG_LABEL}</span>
        </span>
    );
}
