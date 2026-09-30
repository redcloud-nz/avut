/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronsDownUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardAction } from "@/components/ui/card";
import { CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * The collapse toggle in a review page card's header. The card is a `Collapsible` (`asChild` on
 * the `Card`) and its `CardContent` a `CollapsibleContent`; this goes in its `CardHeader`.
 */
export function SkillTrack_SessionReview_CardToggle({ title }: { title: string }) {
    return (
        <CardAction>
            <CollapsibleTrigger asChild>
                {/* Ghost buttons fill in while expanded; here open is the resting state, so only
                    hover does. */}
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="group/toggle aria-expanded:bg-transparent aria-expanded:hover:bg-muted"
                >
                    {/* Arrows apart to expand, together to collapse: not a sideways chevron,
                        which reads as a link elsewhere. */}
                    <ChevronsUpDownIcon className="group-data-[state=open]/toggle:hidden" />
                    <ChevronsDownUpIcon className="group-data-[state=closed]/toggle:hidden" />
                    <span className="sr-only">Show or hide {title}</span>
                </Button>
            </CollapsibleTrigger>
        </CardAction>
    );
}
