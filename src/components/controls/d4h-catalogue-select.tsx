/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, Fragment } from "react";

import { D4HOwner } from "@/components/d4h/d4h-owner";
import { AlertWarningIcon } from "@/components/icons";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CatalogueOptionRecord, groupCatalogueOptions } from "@/lib/d4h-catalogue-options";
import { cn } from "@/lib/utils";

export interface D4HCatalogueSelectProps<T extends CatalogueOptionRecord> extends Omit<
    ComponentProps<typeof Select>,
    "children" | "onValueChange" | "value"
> {
    records: readonly T[];
    value: number | null;
    onChange: (record: T) => void;
    placeholder: string;
    /**
     * The linked D4H organisation's id when only its records should be offered, otherwise
     * `null`. The current selection is always kept, marked when it's owned by anyone else.
     */
    organisationOnlyId: number | null;
    /**
     * The title to show when `value` isn't among `records`, such as a template's snapshot title
     * for a record since deleted in D4H. Shown muted, with a marker.
     */
    fallbackTitle?: string | null;

    slotProps?: {
        trigger?: Omit<ComponentProps<typeof SelectTrigger>, "children">;
        value?: Omit<ComponentProps<typeof SelectValue>, "children">;
        content?: Omit<ComponentProps<typeof SelectContent>, "children">;
    };
}

/**
 * A select for a D4H catalogue record (category, type, brand or model), grouped by the D4H
 * organisation or team that owns it. Each group gets a sticky label and the trigger shows the
 * selected record's owner after its title, even when there's only one owner: that's how a user
 * confirms the records are all their organisation's.
 */
export function D4HCatalogueSelect<T extends CatalogueOptionRecord>({
    records,
    value,
    onChange,
    placeholder,
    organisationOnlyId,
    fallbackTitle,
    slotProps = {},
    ...props
}: D4HCatalogueSelectProps<T>) {
    const groups = groupCatalogueOptions(records, { organisationOnlyId, selectedId: value });

    const selected = groups
        .flatMap((group) => group.options)
        .find((option) => option.record.id === value);

    function handleValueChange(newValue: string) {
        const id = parseInt(newValue, 10);
        const record = records.find((r) => r.id === id);

        if (!record) {
            console.error(`Selected D4H record with id ${id} not found in the records.`);
            return;
        }

        onChange(record);
    }

    return (
        <Select value={value ? value.toString() : ""} onValueChange={handleValueChange} {...props}>
            <SelectTrigger {...slotProps.trigger}>
                <SelectValue
                    placeholder={placeholder}
                    {...slotProps.value}
                    className={cn("flex-1", slotProps.value?.className)}
                >
                    {selected && (
                        <>
                            {selected.record.title}
                            {selected.otherOwnerMarker && (
                                <OtherOwnerMarker label="Not organisation records" />
                            )}
                            {/* Pushed to the trigger's right edge, clear of the title. */}
                            <span className="ml-auto pl-2">
                                <D4HOwner owner={selected.record.owner} variant="compact" />
                            </span>
                        </>
                    )}
                    {!selected && value && fallbackTitle && (
                        <>
                            <span className="text-muted-foreground">{fallbackTitle}</span>
                            <OtherOwnerMarker label="Not found in D4H" />
                        </>
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent {...slotProps.content}>
                {groups.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {organisationOnlyId != null
                            ? "No records owned by your D4H organisation"
                            : "None available"}
                    </div>
                )}
                {groups.map((group, groupIndex) => (
                    <Fragment key={`${group.owner.resourceType}:${group.owner.id}`}>
                        {groupIndex > 0 && <SelectSeparator />}
                        <SelectGroup className="pt-0">
                            {/* Sticky, so the owner stays visible while scrolling a long group. */}
                            <SelectLabel className="sticky top-0 z-10 bg-popover pt-2 font-medium text-foreground">
                                {group.owner.title}
                            </SelectLabel>
                            {group.options.map(({ record, otherOwnerMarker }) => (
                                <SelectItem
                                    key={record.id}
                                    value={record.id.toString()}
                                    className="scroll-mt-8"
                                >
                                    {record.title}
                                    {otherOwnerMarker && (
                                        <OtherOwnerMarker label="Not organisation records" />
                                    )}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </Fragment>
                ))}
            </SelectContent>
        </Select>
    );
}

/** Marks a kept selection that isn't owned by the linked D4H organisation, or is gone from D4H. */
function OtherOwnerMarker({ label }: { label: string }) {
    return (
        <span title={label} className="inline-flex">
            <AlertWarningIcon className="size-3.5 text-amber-600 dark:text-amber-500" />
            <span className="sr-only">{label}</span>
        </span>
    );
}
