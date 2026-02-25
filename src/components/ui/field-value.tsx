/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { formatDistanceToNow } from "date-fns";
import { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/datetime";

type FieldValueProps = Omit<ComponentProps<"div">, "children"> &
    (
        | {
              children?: never;
              value: string | number | Date;
              empty?: never;
              action?: ReactNode;
          }
        | {
              children: ReactNode;
              value?: never;
              empty?: never;
              action?: never;
          }
        | { children?: never; value?: never; empty: true; action?: never }
    ) & {
        muted?: boolean;
        ifEmpty?: ReactNode;
        format?:
            | "default"
            | "date"
            | "datetime"
            | "dateWithDistance"
            | "dateTimeWithDistance"
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
    action,
    empty,
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
                action ? "justify-between" : "",
                className,
            )}
            {...props}
        >
            {empty ? (
                <span className="text-muted-foreground">None</span>
            ) : value == undefined ? (
                <span>{children}</span>
            ) : value == "" ? (
                <span className="text-muted-foreground">None</span>
            ) : (
                <>
                    <span>{formatValue(String(value), format)}</span>
                    {action}
                </>
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
        case "date": {
            const date = new Date(value);
            return formatDate(date);
        }
        case "datetime": {
            const date = new Date(value);
            return formatDateTime(date);
        }
        case "dateWithDistance": {
            const date = new Date(value);
            return (
                <>
                    <span>{formatDate(date)}</span>
                    <span className="pl-2 text-muted-foreground">
                        ({formatDistanceToNow(date, { addSuffix: true })})
                    </span>
                </>
            );
        }
        case "dateTimeWithDistance": {
            const date = new Date(value);
            return (
                <>
                    <span>{formatDateTime(date)}</span>
                    <span className="pl-2 text-muted-foreground">
                        ({formatDistanceToNow(date, { addSuffix: true })})
                    </span>
                </>
            );
        }
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
