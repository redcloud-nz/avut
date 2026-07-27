/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchableSelectOption = {
    value: string;
    label: string;
};

type SearchableSelectProps = {
    value: string | null | undefined;
    onValueChange: (value: string) => void;
    options: SearchableSelectOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    disabled?: boolean;
    "aria-invalid"?: boolean;
    className?: string;
};

export function SearchableSelect({
    value,
    onValueChange,
    options,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyMessage = "No results found.",
    disabled,
    "aria-invalid": ariaInvalid,
    className,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);

    const selectedLabel = options.find((o) => o.value === value)?.label;

    const id = useId();

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-controls={`searchable-select-${id}-content`}
                    aria-expanded={open}
                    aria-invalid={ariaInvalid}
                    disabled={disabled}
                    className={cn(
                        "border-input",
                        "dark:bg-input/30 dark:hover:bg-input/50",
                        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1",
                        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 aria-invalid:ring-1",
                        "flex h-8 w-full items-center justify-between gap-1.5 rounded-none border bg-transparent py-2 pr-2 pl-2.5 text-xs whitespace-nowrap transition-colors outline-none select-none",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        className,
                    )}
                >
                    <span className={cn(!selectedLabel && "text-muted-foreground")}>
                        {selectedLabel ?? placeholder}
                    </span>
                    <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="min-w-(--radix-popover-trigger-width) p-0"
                id={`searchable-select-${id}-content`}
            >
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyMessage}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    data-checked={value === option.value}
                                    onSelect={() => {
                                        onValueChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
