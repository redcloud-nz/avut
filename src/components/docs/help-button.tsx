/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { CircleHelpIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Navbar control that opens the contextual help sheet on a help card. `id` is
 * the card's path under `content/help` without extension (e.g. `"i3"`,
 * `"skill-track/sessions"`). Pass it as a string literal: the coverage test
 * (`help-cards.test.ts`) greps call sites for `id="…"`. The sheet itself
 * (`<HelpSheet>`) is mounted once globally; this only writes the `?help=<id>`
 * param.
 */
export function HelpButton({ id, label = "Help for this page" }: { id: string; label?: string }) {
    const [, setHelp] = useQueryState("help", parseAsString);

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    onClick={() => void setHelp(id, { history: "push" })}
                >
                    <CircleHelpIcon />
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
