/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { CheckIcon, MinusIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

export function Checkbox({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof CheckboxPrimitive.Root>) {
    return (
        <CheckboxPrimitive.Root
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
                className,
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                className={cn("flex items-center justify-center text-current")}
            >
                {props.checked == "indeterminate" ? (
                    <MinusIcon className="h-4 w-4" />
                ) : (
                    <CheckIcon className="h-4 w-4" />
                )}
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
}
