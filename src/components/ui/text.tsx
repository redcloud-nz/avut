/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cn } from "@/lib/utils";

export function Text({
    className,
    ...props
}: React.ComponentPropsWithRef<"p">) {
    return (
        <p
            data-slot="text"
            {...props}
            className={cn(
                "text-base/6 text-zinc-500 sm:text-sm/6 dark:text-zinc-400",
                className,
            )}
        />
    );
}
