/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/datetime";
import { formatDistanceToNow } from "date-fns";

type FieldValueProps = Omit<ComponentProps<"div">, "children"> &
    (
        | { children?: never; value: string | number | Date }
        | { children: ReactNode; value?: never }
    ) & {
        muted?: boolean;
        format?:
            | "default"
            | "date"
            | "dateWithDistance"
            | "id"
            | "uppercase"
            | "lowercase"
            | "capitalize"
            | ((input: string) => ReactNode);
    };

export function FieldValue({
    children,
    className,
    muted = false,
    value,
    format = "default",
    ...props
}: FieldValueProps) {
    return (
        <div
            data-slot="field-value"
            className={cn(
                "w-fit min-w-0 h-9 px-3 py-1", // Sizing and padding
                "flex items-center",
                "border border-transparent rounded-md outline-none", // Border
                "text-base md:text-sm align-baseline overflow-clip", // Text size
                muted ? "text-muted-foreground" : "text-foreground",
                className,
            )}
            {...props}
        >
            {value == undefined ? (
                <span>{children}</span>
            ) : value == "" ? (
                <span className="text-muted-foreground">None</span>
            ) : (
                formatValue(String(value), format)
            )}
        </div>
    );
}

function formatValue(
    value: string,
    format: FieldValueProps["format"],
): ReactNode {
    if (typeof format === "function") {
        return format(value);
    }

    switch (format) {
        case "date":
            const date = new Date(value);
            return formatDate(date);
        case "dateWithDistance":
            const dt = new Date(value);
            return (
                <>
                    <span>{formatDate(dt)}</span>
                    <span className="pl-2 text-muted-foreground">
                        ({formatDistanceToNow(dt, { addSuffix: true })})
                    </span>
                </>
            );
        case "id":
            return <code className="font-mono">{value}</code>;
        case "uppercase":
            return value.toUpperCase();
        case "lowercase":
            return value.toLowerCase();
        case "capitalize":
            return value.charAt(0).toUpperCase() + value.slice(1);
        case "default":
        default:
            return value;
    }
}
