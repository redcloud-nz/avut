/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { formatISO, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import { DateRange, formatDateRange } from "@/lib/schemas/date-range";

export interface DatePickerProps {
    className?: string;
    name?: string;
    onValueChange: (newValue: DateRange | undefined) => void;
    placeholder?: string;
    size?: "default" | "sm";
    value: DateRange | undefined;
}

export function DateRangePicker({
    className,
    onValueChange = () => {},
    placeholder = "Pick a date",
    value,
    size = "default",
}: DatePickerProps) {
    function handleSelect(selected: { from?: Date; to?: Date } | undefined) {
        const fromStr = selected?.from
            ? formatISO(selected.from, { representation: "date" })
            : undefined;
        const toStr = selected?.to
            ? formatISO(selected.to, { representation: "date" })
            : undefined;

        const strRange: DateRange = {
            from: fromStr,
            to: toStr,
        };
        onValueChange(strRange);
    }

    const selected = value
        ? {
              from: value.from ? parseISO(value.from) : undefined,
              to: value.to ? parseISO(value.to) : undefined,
          }
        : undefined;

    return (
        <Popover>
            <PopoverTrigger
                data-size={size}
                className={cn(
                    "border-input flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color-box-shadow] outline-none",
                    "data-[size=default]:h-9 data-[size=sm]:h-8",
                    "disabled:cursor-not-allowed disabled:opacity-50", // disabled styles
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]", // focus styles
                    "aria-invalid:ring-destructive/20 aria-invalid:border-destructive", // aria-invalid styles
                    className,
                )}
            >
                {selected ? (
                    formatDateRange(selected)
                ) : (
                    <span className="text-muted-foreground">{placeholder}</span>
                )}
                <CalendarIcon className="size-4 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0">
                <Calendar
                    mode="range"
                    selected={selected}
                    disabled={{ before: new Date(2024, 0, 1) }}
                    captionLayout="dropdown"
                    onSelect={handleSelect}
                    autoFocus
                />
            </PopoverContent>
        </Popover>
    );
}
