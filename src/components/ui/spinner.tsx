/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Loader2Icon } from "lucide-react";
import { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Spinner({ className, ...props }: ComponentProps<"svg">) {
    return (
        <Loader2Icon
            role="status"
            aria-label="Loading"
            className={cn("size-4 animate-spin", className)}
            {...props}
        />
    );
}
