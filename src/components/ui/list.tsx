/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function List({ className, ...props }: ComponentProps<"ul">) {
    return (
        <ul
            className={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)}
            {...props}
        />
    );
}

export function ListItem({ ...props }: ComponentProps<"li">) {
    return <li {...props} />;
}
