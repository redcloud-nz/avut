/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { formatISO, parseISO } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { ComponentProps } from "react";

import { formatDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "../ui/button";

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
        popoverContent?: Omit<ComponentProps<typeof PopoverContent>, "children">;
        popoverTrigger?: Omit<ComponentProps<typeof PopoverTrigger>, "children">;
    };
}

export function DatePicker({
    className,
    id,
    onValueChange = () => {},
    placeholder = "Pick a date",
    size = "default",
    slotProps = {},
    value,
}: DatePickerProps) {
    function handleSelect(selected: Date | undefined) {
        const str = selected ? formatISO(selected) : undefined;

        onValueChange(str);
    }

    const selected = value ? parseISO(value) : undefined;

    const {
        calendar: calendarProps = {},
        popover: popoverProps = {},
        popoverContent: { className: popoverContentClassName, ...popoverContentProps } = {},
        popoverTrigger: { className: popoverTriggerClassName, ...popoverTriggerProps } = {},
    } = slotProps;

    return (
        <Popover>
            <PopoverTrigger
                id={id}
                data-size={size}
                className={cn(
                    "border-input flex w-fit items-center justify-between gap-2 border bg-transparent pr-2 pl-2.5 py-2 text-xs whitespace-nowrap transition-colors outline-none",
                    "data-[size=default]:h-8 data-[size=sm]:h-7",
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
                className={cn("w-auto overflow-hidden p-0", popoverContentClassName)}
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
