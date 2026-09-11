/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
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
    subtitle?: string;
    badge?: string;
};

function HighlightMatch({ text, query }: { text: string; query: string }) {
    if (!query) return text;

    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    return (
        <>
            {text.slice(0, index)}
            <mark className="rounded-xs bg-yellow-300/60 text-inherit dark:bg-yellow-300/25">
                {text.slice(index, index + query.length)}
            </mark>
            {text.slice(index + query.length)}
        </>
    );
}

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
    id?: string;
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
    id: providedId,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selectedLabel = options.find((o) => o.value === value)?.label;

    const id = useId();

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setSearch("");
            }}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    id={providedId}
                    aria-controls={`searchable-select-${id}-content`}
                    aria-expanded={open}
                    aria-invalid={ariaInvalid}
                    disabled={disabled}
                    className={cn(
                        "border-input",
                        "dark:bg-input/30 dark:hover:bg-input/50",
                        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
                        "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        className,
                    )}
                >
                    <span className={cn(!selectedLabel && "text-muted-foreground")}>
                        {selectedLabel ?? placeholder}
                    </span>
                    <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="min-w-(--radix-popover-trigger-width) p-0"
                id={`searchable-select-${id}-content`}
            >
                <Command
                    filter={(value, search) =>
                        value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }
                >
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>{emptyMessage}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={`${option.label} ${option.subtitle ?? ""}`}
                                    data-checked={value === option.value}
                                    onSelect={() => {
                                        onValueChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <div className="flex min-w-0 flex-col">
                                        <span className="flex items-center gap-1.5 truncate">
                                            <span className="truncate">
                                                <HighlightMatch
                                                    text={option.label}
                                                    query={search}
                                                />
                                            </span>
                                            {option.badge && (
                                                <Badge variant="outline" className="shrink-0">
                                                    {option.badge}
                                                </Badge>
                                            )}
                                        </span>
                                        {option.subtitle && (
                                            <span className="text-muted-foreground truncate text-xs">
                                                <HighlightMatch
                                                    text={option.subtitle}
                                                    query={search}
                                                />
                                            </span>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
