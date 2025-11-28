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

import { TeamData } from "@/lib/schemas/team";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { useOrganization } from "@/hooks/use-organization";

interface TeamPickerProps {
    /**
     * Optional CSS class name for the component.
     */
    className?: string;

    /**
     * Default value for the picker, used when no value is provided.
     */
    defaultValue?: string;

    /**
     * List of team IDs to exclude from the picker options.
     */
    exclude?: string[];

    /**
     * Callback function that is called when a team is selected.
     * It receives the selected team data as an argument.
     */
    onValueChange?: (team: TeamData) => void;

    /**
     * Placeholder text to display when no team is selected.
     */
    placeholder?: string;

    /**
     * Size of the picker, can be 'default' or 'sm'.
     */
    size?: "default" | "sm";

    /**
     * Current value of the picker, used to control the selected team.
     */
    value?: string;
}

/**
 * A component for selecting a team from a list, with search functionality.
 * It uses a popover to display the list of teams and allows filtering by name.
 */
export function TeamPicker({
    className,
    defaultValue = "",
    exclude = [],
    onValueChange,
    placeholder,
    size,
    value,
}: TeamPickerProps) {
    const organization = useOrganization();

    const query = useQuery(
        trpc.teams.getTeams.queryOptions({ orgId: organization.orgId }),
    );

    const [open, setOpen] = useState(false);
    const [internalValue, setInternalValue] = useState<string>(
        value ?? defaultValue,
    );

    const handleSelect = (teamId: string) => {
        if (teamId !== internalValue) {
            setInternalValue(teamId);

            const selectedTeam = query.data!.find(
                (team) => team.teamId === teamId,
            )!;

            onValueChange?.(selectedTeam);
            setOpen(false);
        }
    };

    const effectiveValue = value ?? internalValue;
    const filteredTeams = (query.data ?? []).filter(
        (team) => team.status === "Active",
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
                        ? query.data.find((team) => team.teamId === value)?.name
                        : (placeholder ?? "Select team...")
                    : "Loading..."}

                <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" portal={false}>
                <Command>
                    <CommandInput placeholder="Search teams..." />
                    <CommandList>
                        <CommandEmpty>No teams found.</CommandEmpty>
                        <CommandGroup>
                            {filteredTeams.map((team) => (
                                <CommandItem
                                    key={team.teamId}
                                    value={team.teamId}
                                    disabled={exclude.includes(team.teamId)}
                                    onSelect={() => handleSelect(team.teamId)}
                                    className={cn(
                                        "cursor-pointer",
                                        value === team.teamId && "bg-accent",
                                    )}
                                >
                                    <CheckIcon
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === team.teamId
                                                ? "opacity-100"
                                                : "opacity-0",
                                        )}
                                    />
                                    {team.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
