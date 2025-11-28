/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import Image from "next/image";
import { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function RTPlusLogo({
    className,
    ...props
}: Omit<ComponentProps<typeof Image>, "src" | "alt" | "width" | "height">) {
    return (
        <Image
            className={cn("dark:invert", className)}
            src="/logo.svg"
            alt="RT+ logo"
            width={300}
            height={150}
            priority
            {...props}
        />
    );
}
