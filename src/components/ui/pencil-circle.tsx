/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cn } from "@/lib/utils";

/**
 * A hand-drawn loop around its (relatively positioned) parent: one wobbly stroke whose end
 * overshoots its start, as if circled with a pencil. Marks a chosen value on a form without
 * making it look like a pressed button.
 */
export function PencilCircle({ className }: { className?: string }) {
    return (
        <svg
            aria-hidden
            data-slot="pencil-circle"
            viewBox="0 0 32 32"
            preserveAspectRatio="none"
            // An explicit size, or Button's `[&_svg]` rule shrinks it to an icon.
            className={cn(
                "pointer-events-none absolute -top-0.5 -left-0.5 size-[calc(100%+0.25rem)] overflow-visible text-foreground/30",
                className,
            )}
        >
            <path
                d="M23.6 6.4C18.2 3.3 8.4 4.6 5.3 10.9 2.7 16.4 5.4 24.6 12.4 26.9 19.6 29.1 27.3 25.1 27.9 17.4 28.4 11.3 24.1 6.6 16.8 6.1"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
