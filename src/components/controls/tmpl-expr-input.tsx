/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps } from "react";

import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";

interface TmplExprInputProps extends ComponentProps<typeof Input> {}

export function TmplExprInput({ className, ...props }: TmplExprInputProps) {
    return <Input className={cn("font-mono", className)} {...props} />;
}
