/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, createContext, ReactNode, useContext } from "react";
import { tv } from "tailwind-variants";

import { cn } from "@/lib/utils";

import {
    FormControl,
    FormDescription,
    FormItem,
    FormLabel,
    FormMessage,
} from "./form";
import { Label } from "./label";

type ToruGridContextValue = { mode: "default" | "form" };
const ToruGridContext = createContext<ToruGridContextValue>({
    mode: "default",
});

export function ToruGrid({
    className,
    mode = "default",
    ...props
}: ComponentProps<"div"> & { mode?: "default" | "form" }) {
    return (
        <ToruGridContext.Provider value={{ mode }}>
            <div
                className={cn(
                    "flex flex-col lg:grid lg:grid-cols-[min(20%,--spacing(80))_1fr_1fr]",
                    className,
                )}
                data-component="ToruGrid"
                data-mode={mode}
                {...props}
            />
        </ToruGridContext.Provider>
    );
}

const toruGridRowVariants = tv({
    base: " flex flex-col lg:grid lg:col-span-full lg:grid-cols-subgrid border-t border-zinc-950/5 py-1 first:border-none gap-2",
    slots: {
        label: "pt-3 pl-2",
        control: "sm:col-start-2",
        description:
            "hidden lg:block lg:col-start-3 lg:col-span-1 pl-2 align-middle",
        message: "sm:col-start-1 lg:col-start-2 sm:col-span-2 pt-1 pl-2",
    },
    variants: {
        compact: {
            true: {
                label: "py-1",
            },
            false: {
                label: "pt-3",
            },
        },
    },
});

interface ToruGridRowProps extends Omit<ComponentProps<"div">, "children"> {
    label: ReactNode;
    compact?: boolean;
    control: ReactNode;
    description?: ReactNode;
}

export function ToruGridRow({
    className,
    compact = false,
    control,
    description,
    label,
    ...props
}: ToruGridRowProps) {
    const { mode } = useContext(ToruGridContext);

    const slots = toruGridRowVariants({ className, compact });

    if (mode == "form") {
        return (
            <FormItem className={slots.base()}>
                <FormLabel className={slots.label()}>{label}</FormLabel>
                <FormControl className={slots.control()}>{control}</FormControl>
                {description ? (
                    <FormDescription className={slots.description()}>
                        {description}
                    </FormDescription>
                ) : null}
                <FormMessage className={slots.message()} />
            </FormItem>
        );
    } else {
        return (
            <div className={slots.base()} {...props}>
                <Label className={slots.label()}>{label}</Label>
                <div className={slots.control()}>{control}</div>
            </div>
        );
    }
}

export function ToruGridFooter({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "h-10 pt-1 flex items-center gap-2 col-span-full border-t border-zinc-950/5",
                className,
            )}
            {...props}
        />
    );
}
