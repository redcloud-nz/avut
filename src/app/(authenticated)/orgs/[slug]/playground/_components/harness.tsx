/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { MoonIcon, RotateCcwIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Shared frame for a playground sandbox page. Provides a viewport-width switcher,
 * a light/dark toggle, a reset control, and a slot for the page's own bespoke
 * control panel. Plain dev tooling — deliberately not a codenamed `blocks/` entry.
 *
 * `resetKey` is a state key: bump it (via the reset button) to remount `children`
 * and any local state the sandboxed component holds. Pages that keep their own
 * control state should also key off `onReset`.
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
    children,
    onReset,
}: {
    title: string;
    description?: string;
    controls?: ReactNode;
    children: ReactNode;
    onReset?: () => void;
}) {
    const { resolvedTheme, setTheme } = useTheme();
    const [width, setWidth] = useState<WidthKey>("full");
    const [resetKey, setResetKey] = useState(0);

    const maxWidth = WIDTHS[width];

    function handleReset() {
        setResetKey((k) => k + 1);
        onReset?.();
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

                <Separator orientation="vertical" className="h-6" />

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

                <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcwIcon className="size-4" />
                    Reset
                </Button>
            </div>

            {controls ? (
                <div className="space-y-2 rounded-lg border p-3">
                    <h2 className="text-sm font-medium text-muted-foreground">Controls</h2>
                    {controls}
                </div>
            ) : null}

            <div className="rounded-lg border border-dashed p-4">
                <div
                    className={cn("mx-auto transition-[max-width]", maxWidth && "border-x px-4")}
                    style={maxWidth ? { maxWidth } : undefined}
                >
                    <div key={resetKey}>{children}</div>
                </div>
            </div>
        </div>
    );
}
