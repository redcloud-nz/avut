/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";

import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

interface PersonPickerProps {
    value: PersonId | null;
    onValueChange: (value: PersonId | null) => void;
    organizationId: OrganizationId;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
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
}: PersonPickerProps) {
    const personnelQuery = useQuery(trpc.personnel.listPersonnel.queryOptions({ organizationId }));

    const options = useMemo(
        () =>
            [...(personnelQuery.data ?? [])]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((person) => ({ value: person.id, label: person.name })),
        [personnelQuery.data],
    );

    if (personnelQuery.isPending) {
        return <Skeleton className="h-9 w-full" />;
    }

    return (
        <SearchableSelect
            className={className}
            value={value}
            onValueChange={(next) => onValueChange((next as PersonId) || null)}
            options={options}
            placeholder={placeholder}
            disabled={disabled}
            emptyMessage="No personnel in this organization."
        />
    );
}
