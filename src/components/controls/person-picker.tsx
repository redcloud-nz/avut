/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ListFilterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";

import { OrganizationId } from "@/lib/schemas/organization";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

type StatusFilter = "active" | "archived" | "all";

interface PersonPickerProps {
    value: PersonId | null;
    onValueChange: (value: PersonId | null) => void;
    organizationId: OrganizationId;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    /** Extra predicate a person must satisfy to appear, e.g. excluding people already assigned elsewhere. */
    filter?: (person: PersonData) => boolean;
    id?: string;
    "aria-invalid"?: boolean;
}

/**
 * Picks a person from the current organization. Backed by the org-scoped
 * `personnel.listPersonnel` query, so it only renders meaningfully inside an
 * organization context.
 */
export function PersonPicker({
    value,
    onValueChange,
    organizationId,
    disabled,
    placeholder = "Select a person",
    className,
    filter,
    id,
    "aria-invalid": ariaInvalid,
}: PersonPickerProps) {
    const personnelQuery = useQuery(trpc.personnel.listPersonnel.queryOptions({ organizationId }));
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

    const options = useMemo(
        () =>
            [...(personnelQuery.data ?? [])]
                .filter(
                    (person) =>
                        (statusFilter === "all" ||
                            (statusFilter === "active" && person.status === "Active") ||
                            (statusFilter === "archived" && person.status === "Archived")) &&
                        (!filter || filter(person)),
                )
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((person) => ({
                    value: person.id,
                    label: person.name,
                    subtitle: person.email,
                    badge:
                        statusFilter === "all" && person.status === "Archived"
                            ? "Archived"
                            : undefined,
                })),
        [personnelQuery.data, statusFilter, filter],
    );

    if (personnelQuery.isPending) {
        return <Skeleton className="h-9 w-full" />;
    }

    return (
        <ButtonGroup className={cn("w-full", className)}>
            <SearchableSelect
                className="flex-1"
                id={id}
                value={value}
                onValueChange={(next) => onValueChange((next as PersonId) || null)}
                options={options}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={ariaInvalid}
                emptyMessage={`No ${statusFilter === "all" ? "" : `${statusFilter} `}personnel in this organization.`}
            />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={disabled}
                        aria-invalid={ariaInvalid}
                        aria-label="Filter by status"
                    >
                        <ListFilterIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                        value={statusFilter}
                        onValueChange={(next) => setStatusFilter(next as StatusFilter)}
                    >
                        <DropdownMenuLabel>Status</DropdownMenuLabel>
                        <DropdownMenuRadioItem value="active">Active</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="archived">Archived</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </ButtonGroup>
    );
}
