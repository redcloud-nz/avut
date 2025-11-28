/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useState } from "react";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { selectTriggerVariants } from "@/components/ui/select";

import { useOrganization } from "@/hooks/use-organization";
import { PersonData } from "@/lib/schemas/person";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface PersonPickerProps {
    /**
     * Optional CSS class name for the component.
     */
    className?: string;

    /**
     * Default value for the picker, used when no value is provided.
     */
    defaultValue?: string;

    /**
     * List of person IDs to exclude from the picker options.
     */
    exclude?: string[];

    filter?: {
        status?: ("Active" | "Inactive")[];
        isUser?: boolean;
    };

    /**
     * Callback function that is called when a person is selected.
     * It receives the selected person data as an argument.
     */
    onValueChange?: (person: PersonData) => void;

    /**
     * Placeholder text to display when no person is selected.
     */
    placeholder?: string;

    /**
     * Size of the picker, can be 'default' or 'sm'.
     */
    size?: "default" | "sm";

    /**
     * Current value of the picker, used to control the selected person.
     */
    value?: string;
}

/**
 * A component for selecting a person from a list, with search functionality.
 * It uses a popover to display the list of persons and allows filtering by name.
 */
export function PersonPicker({
    className,
    defaultValue = "",
    exclude = [],
    filter = {},
    onValueChange,
    placeholder,
    size,
    value,
}: PersonPickerProps) {
    filter = { status: ["Active"], ...filter };

    const organization = useOrganization();

    const query = useQuery(
        trpc.personnel.getPersonnel.queryOptions({
            orgId: organization.orgId,
            ...filter,
        }),
    );

    const [open, setOpen] = useState(false);
    const [internalValue, setInternalValue] = useState<string>(
        value ?? defaultValue,
    );

    const handleSelect = (personId: string) => {
        if (personId !== internalValue) {
            setInternalValue(personId);

            const selectedPerson = query.data!.find(
                (person) => person.personId === personId,
            )!;
            onValueChange?.(selectedPerson);
            setOpen(false);
        }
    };

    const effectiveValue = value ?? internalValue;
    const filteredPersonnel = (query.data ?? []).filter(
        (person) => person.status == "Active",
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                role="combobox"
                aria-expanded={open}
                className={selectTriggerVariants({ className, size })}
            >
                {query.data
                    ? effectiveValue
                        ? query.data.find((person) => person.personId === value)
                              ?.name
                        : (placeholder ?? "Select person...")
                    : "Loading..."}
                <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" portal={false}>
                <Command>
                    <CommandInput placeholder="Search personnel..." />
                    <CommandList>
                        <CommandEmpty>
                            No available personnel found.
                        </CommandEmpty>
                        <CommandGroup>
                            {filteredPersonnel.map((person) => (
                                <CommandItem
                                    key={person.personId}
                                    value={person.personId}
                                    disabled={exclude.includes(person.personId)}
                                    onSelect={() =>
                                        handleSelect(person.personId)
                                    }
                                    className={cn(
                                        "cursor-pointer",
                                        effectiveValue === person.personId &&
                                            "bg-accent",
                                    )}
                                >
                                    <CheckIcon
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            effectiveValue === person.personId
                                                ? "opacity-100"
                                                : "opacity-0",
                                        )}
                                    />
                                    {person.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
