/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import {
    CheckIcon,
    ChevronDownIcon,
    CopyIcon,
    MoonIcon,
    RotateCcwIcon,
    SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Shared frame for a playground sandbox page. Provides a viewport-width switcher,
 * a light/dark toggle, a collapsible slot for the page's own bespoke control
 * panel with a reset affordance, and an optional "Code" card showing the JSX for
 * the current control values. Plain dev tooling — deliberately not a codenamed
 * `blocks/` entry.
 *
 * `onReset` should restore the page's control state to its defaults; the reset
 * button lives in the controls header and does nothing else. `code` is the
 * page-built JSX snippet reflecting the configured props.
 */
const WIDTHS = {
    sm: 375,
    md: 768,
    lg: 1024,
    full: null,
} as const;

type WidthKey = keyof typeof WIDTHS;

export function Harness({
    title,
    description,
    controls,
    code,
    children,
    onReset,
}: {
    title: string;
    description?: string;
    controls?: ReactNode;
    code?: string;
    children: ReactNode;
    onReset?: () => void;
}) {
    const { resolvedTheme, setTheme } = useTheme();
    const [width, setWidth] = useState<WidthKey>("full");
    const [controlsOpen, setControlsOpen] = useState(true);
    const [codeOpen, setCodeOpen] = useState(true);
    const [copied, setCopied] = useState(false);

    const maxWidth = WIDTHS[width];

    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 1500);
        return () => clearTimeout(t);
    }, [copied]);

    function copyCode() {
        if (!code) return;
        void navigator.clipboard?.writeText(code).then(() => setCopied(true));
    }

    return (
        <div className="mx-auto w-full max-w-5xl space-y-4">
            <header className="space-y-0.5">
                <h1 className="text-xl font-semibold">{title}</h1>
                {description ? (
                    <p className="text-sm text-muted-foreground">{description}</p>
                ) : null}
            </header>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
                <ToggleGroup
                    type="single"
                    value={width}
                    onValueChange={(v) => v && setWidth(v as WidthKey)}
                    variant="outline"
                    size="sm"
                >
                    <ToggleGroupItem value="sm">375</ToggleGroupItem>
                    <ToggleGroupItem value="md">768</ToggleGroupItem>
                    <ToggleGroupItem value="lg">1024</ToggleGroupItem>
                    <ToggleGroupItem value="full">Full</ToggleGroupItem>
                </ToggleGroup>

                <Separator orientation="vertical" className="hidden h-6 sm:block" />

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                >
                    {resolvedTheme === "dark" ? (
                        <SunIcon className="size-4" />
                    ) : (
                        <MoonIcon className="size-4" />
                    )}
                    {resolvedTheme === "dark" ? "Light" : "Dark"}
                </Button>
            </div>

            {controls ? (
                <Collapsible
                    open={controlsOpen}
                    onOpenChange={setControlsOpen}
                    className="rounded-lg border"
                >
                    <div className="flex items-center justify-between gap-2 p-2 pl-3">
                        <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                            <ChevronDownIcon className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
                            Controls
                        </CollapsibleTrigger>
                        {onReset ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={onReset}
                                aria-label="Reset controls"
                            >
                                <RotateCcwIcon className="size-4" />
                            </Button>
                        ) : null}
                    </div>
                    <CollapsibleContent className="space-y-2 p-3 pt-0">
                        {controls}
                    </CollapsibleContent>
                </Collapsible>
            ) : null}

            {code ? (
                <Collapsible
                    open={codeOpen}
                    onOpenChange={setCodeOpen}
                    className="rounded-lg border"
                >
                    <div className="flex items-center justify-between gap-2 p-2 pl-3">
                        <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                            <ChevronDownIcon className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
                            Code
                        </CollapsibleTrigger>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={copyCode}
                            aria-label="Copy code"
                        >
                            {copied ? (
                                <CheckIcon className="size-4" />
                            ) : (
                                <CopyIcon className="size-4" />
                            )}
                        </Button>
                    </div>
                    <CollapsibleContent className="p-3 pt-0">
                        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                            <code>{code}</code>
                        </pre>
                    </CollapsibleContent>
                </Collapsible>
            ) : null}

            <div className="rounded-lg border border-dashed p-4">
                <div
                    className={cn("mx-auto transition-[max-width]", maxWidth && "border-x px-4")}
                    style={maxWidth ? { maxWidth } : undefined}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
