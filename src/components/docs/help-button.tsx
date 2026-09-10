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
 * Navbar control that opens the contextual help sheet for a specific doc page.
 * `slug` is the doc's slug under `content/docs` (e.g. `"i3"`,
 * `"getting-started/signing-in"`). The sheet itself (`<HelpSheet>`) is mounted
 * once globally; this only writes the `?help=<slug>` param.
 */
export function HelpButton({
    slug,
    label = "Help for this page",
}: {
    slug: string;
    label?: string;
}) {
    const [, setHelp] = useQueryState("help", parseAsString);

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    onClick={() => void setHelp(slug, { history: "push" })}
                >
                    <CircleHelpIcon />
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
