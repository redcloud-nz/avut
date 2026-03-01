/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import React from "react";

import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type LabelProps = React.ComponentPropsWithRef<typeof LabelPrimitive.Root>;

export function Label({ className, ...props }: LabelProps) {
    return (
        <LabelPrimitive.Root
            className={cn(
                "flex items-center gap-2 text-xs leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                className,
            )}
            data-slot="label"
            {...props}
        />
    );
}
