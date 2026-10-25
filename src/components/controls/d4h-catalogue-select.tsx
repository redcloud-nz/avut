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

    slotProps?: {
        trigger?: Omit<ComponentProps<typeof SelectTrigger>, "children">;
        value?: Omit<ComponentProps<typeof SelectValue>, "children">;
        content?: Omit<ComponentProps<typeof SelectContent>, "children">;
    };
}

/**
 * A select for a D4H catalogue record (category, type, brand or model), grouped by the D4H
 * organisation or team that owns it. With more than one owner, the groups get sticky labels and
 * the trigger shows the selected record's owner after its title.
 */
export function D4HCatalogueSelect<T extends CatalogueOptionRecord>({
    records,
    value,
    onChange,
    placeholder,
    organisationOnlyId,
    slotProps = {},
    ...props
}: D4HCatalogueSelectProps<T>) {
    const groups = groupCatalogueOptions(records, { organisationOnlyId, selectedId: value });
    const grouped = groups.length > 1;

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
                <SelectValue placeholder={placeholder} {...slotProps.value}>
                    {selected && (
                        <>
                            {selected.record.title}
                            {selected.otherOwnerMarker && <OtherOwnerMarker />}
                            {grouped && (
                                <D4HOwner owner={selected.record.owner} variant="compact" />
                            )}
                        </>
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent {...slotProps.content}>
                {groups.map((group, groupIndex) => (
                    <Fragment key={`${group.owner.resourceType}:${group.owner.id}`}>
                        {groupIndex > 0 && <SelectSeparator />}
                        <SelectGroup className={grouped ? "pt-0" : undefined}>
                            {/* Sticky, so the owner stays visible while scrolling a long group. */}
                            {grouped && (
                                <SelectLabel className="sticky top-0 z-10 bg-popover pt-2 font-medium text-foreground">
                                    {group.owner.title}
                                </SelectLabel>
                            )}
                            {group.options.map(({ record, otherOwnerMarker }) => (
                                <SelectItem
                                    key={record.id}
                                    value={record.id.toString()}
                                    className={grouped ? "scroll-mt-8" : undefined}
                                >
                                    {record.title}
                                    {otherOwnerMarker && <OtherOwnerMarker />}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </Fragment>
                ))}
            </SelectContent>
        </Select>
    );
}

/** Marks a kept selection that isn't owned by the linked D4H organisation. */
function OtherOwnerMarker() {
    return (
        <span title="Not organisation records" className="inline-flex">
            <AlertWarningIcon className="size-3.5 text-amber-600 dark:text-amber-500" />
            <span className="sr-only">Not organisation records</span>
        </span>
    );
}
