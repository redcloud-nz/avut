/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { CircleHelpIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";

import { useHelpCardRoutes } from "@/components/docs/help-routes-context";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { mostSpecificMatch } from "@/lib/route-pattern";

const LABEL = "Help for this page";

/**
 * Navbar control that opens the contextual help sheet on the current page's help card: the
 * card whose `routes` frontmatter best matches the pathname (`mostSpecificMatch`). Renders
 * nothing when no card covers the page. The sheet itself (`<HelpSheet>`) is mounted once
 * globally; this only writes the `?help=<id>` param.
 *
 * `usePathname()` can suspend during prerender, so render it inside a `<Suspense>`.
 */
export function PageHelpButton() {
    const pathname = usePathname();
    const card = mostSpecificMatch(useHelpCardRoutes(), pathname);
    const [, setHelp] = useQueryState("help", parseAsString);

    if (!card) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={LABEL}
                    onClick={() => void setHelp(card.id, { history: "push" })}
                >
                    <CircleHelpIcon />
                </Button>
            </TooltipTrigger>
            <TooltipContent>{LABEL}</TooltipContent>
        </Tooltip>
    );
}
