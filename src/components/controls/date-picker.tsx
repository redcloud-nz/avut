/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { formatISO, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { formatDate } from "@/lib/utils";

import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import { selectTriggerVariants } from "@/components/ui/select";

export interface DatePickerProps {
    className?: string;
    defaultValue?: string;
    name?: string;
    onValueChange?: (newValue: string) => void;
    placeholder?: string;
    size?: "default" | "sm";
    value?: string;
}

export function DatePicker({
    className,
    defaultValue = "",
    onValueChange = () => {},
    placeholder = "Pick a date",
    value,
    size = "default",
}: DatePickerProps) {
    const [internalValue, setInternalValue] = useState<string>(
        value ?? defaultValue,
    );

    function handleSelect(selected: Date | undefined) {
        const str = selected
            ? formatISO(selected, { representation: "date" })
            : "";

        if (str != internalValue) {
            setInternalValue(str);
            onValueChange(str);
        }
    }

    const effectiveValue = value ?? internalValue;

    const date = effectiveValue ? parseISO(effectiveValue) : undefined;

    return (
        <Popover>
            <PopoverTrigger
                className={selectTriggerVariants({ className, size })}
            >
                {date ? formatDate(date) : <span>{placeholder}</span>}
                <CalendarIcon className="mr-2 h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0">
                <Calendar
                    mode="single"
                    selected={date}
                    captionLayout="dropdown"
                    onSelect={handleSelect}
                    autoFocus
                />
            </PopoverContent>
        </Popover>
    );
}
