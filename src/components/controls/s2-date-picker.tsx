/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { formatISO, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { ComponentProps } from "react";

import { cn, formatDate } from "@/lib/utils";

import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
    className?: string;
    id?: string;
    onValueChange: (newValue: string | undefined) => void;
    placeholder?: string;
    size?: "default" | "sm";
    value: string | undefined;
    slotProps?: {
        calendar?: Omit<
            ComponentProps<typeof Calendar>,
            "captionLayout" | "mode" | "onSelect" | "selected"
        >;
        popover?: Omit<ComponentProps<typeof Popover>, "children">;
        popoverContent?: Omit<
            ComponentProps<typeof PopoverContent>,
            "children"
        >;
        popoverTrigger?: Omit<
            ComponentProps<typeof PopoverTrigger>,
            "children"
        >;
    };
}

export function S2_DatePicker({
    className,
    id,
    onValueChange = () => {},
    placeholder = "Pick a date",
    size = "default",
    slotProps = {},
    value,
}: DatePickerProps) {
    function handleSelect(selected: Date | undefined) {
        const str = selected
            ? formatISO(selected, { representation: "date" })
            : undefined;

        onValueChange(str);
    }

    const selected = value ? parseISO(value) : undefined;

    const {
        calendar: calendarProps = {},
        popover: popoverProps = {},
        popoverContent: {
            className: popoverContentClassName,
            ...popoverContentProps
        } = {},
        popoverTrigger: {
            className: popoverTriggerClassName,
            ...popoverTriggerProps
        } = {},
    } = slotProps;

    return (
        <Popover>
            <PopoverTrigger
                id={id}
                data-size={size}
                className={cn(
                    "border-input flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color-box-shadow] outline-none",
                    "data-[size=default]:h-9 data-[size=sm]:h-8",
                    "disabled:cursor-not-allowed disabled:opacity-50", // disabled styles
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]", // focus styles
                    "aria-invalid:ring-destructive/20 aria-invalid:border-destructive", // aria-invalid styles
                    className,
                    popoverTriggerClassName,
                )}
                {...popoverTriggerProps}
            >
                {selected ? (
                    formatDate(selected)
                ) : (
                    <span className="text-muted-foreground">{placeholder}</span>
                )}
                <CalendarIcon className="size-4 opacity-50" />
            </PopoverTrigger>
            <PopoverContent
                className={cn(
                    "w-auto overflow-hidden p-0",
                    popoverContentClassName,
                )}
                {...popoverContentProps}
            >
                <Calendar
                    mode="single"
                    selected={selected}
                    captionLayout="dropdown"
                    onSelect={handleSelect}
                    autoFocus
                />
            </PopoverContent>
        </Popover>
    );
}
