/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";

import { Harness } from "../_components/harness";

const FRUIT_OPTIONS: SearchableSelectOption[] = [
    { value: "apple", label: "Apple", subtitle: "Malus domestica" },
    { value: "banana", label: "Banana", subtitle: "Musa acuminata" },
    { value: "cherry", label: "Cherry", subtitle: "Prunus avium" },
    { value: "durian", label: "Durian", subtitle: "Durio zibethinus" },
    { value: "elderberry", label: "Elderberry", subtitle: "Sambucus nigra" },
];

export function Select_Sandbox() {
    const [nativeValue, setNativeValue] = useState<string | undefined>(undefined);
    const [searchableValue, setSearchableValue] = useState<string | null>(null);
    const [disabled, setDisabled] = useState(false);
    const [ariaInvalid, setAriaInvalid] = useState(false);

    const code = [
        `<Select value={value} onValueChange={setValue}${disabled ? " disabled" : ""}>`,
        `    <SelectTrigger className="w-full"${ariaInvalid ? " aria-invalid" : ""}>`,
        `        <SelectValue placeholder="Select a fruit" />`,
        `    </SelectTrigger>`,
        `    <SelectContent>`,
        `        <SelectItem value="apple">Apple</SelectItem>`,
        `        ...`,
        `    </SelectContent>`,
        `</Select>`,
        ``,
        `<SearchableSelect`,
        `    value={value}`,
        `    onValueChange={setValue}`,
        `    options={options}`,
        `    placeholder="Select a fruit"`,
        ...(disabled ? [`    disabled`] : []),
        ...(ariaInvalid ? [`    aria-invalid`] : []),
        `/>`,
    ].join("\n");

    return (
        <Harness
            title="Select"
            description="Native shadcn Select side-by-side with the custom SearchableSelect, so the two can be visually compared against the same options and control state."
            onReset={() => {
                setNativeValue(undefined);
                setSearchableValue(null);
                setDisabled(false);
                setAriaInvalid(false);
            }}
            controls={
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="select-disabled"
                            checked={disabled}
                            onCheckedChange={setDisabled}
                        />
                        <Label htmlFor="select-disabled">Disabled</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            id="select-aria-invalid"
                            checked={ariaInvalid}
                            onCheckedChange={setAriaInvalid}
                        />
                        <Label htmlFor="select-aria-invalid">Aria invalid</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Native: <code>{nativeValue ?? "undefined"}</code> · Searchable:{" "}
                        <code>{searchableValue ?? "null"}</code>
                    </p>
                </div>
            }
            code={code}
        >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label>Select</Label>
                    <Select value={nativeValue} onValueChange={setNativeValue} disabled={disabled}>
                        <SelectTrigger className="w-full" aria-invalid={ariaInvalid}>
                            <SelectValue placeholder="Select a fruit" />
                        </SelectTrigger>
                        <SelectContent>
                            {FRUIT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label>SearchableSelect</Label>
                    <SearchableSelect
                        value={searchableValue}
                        onValueChange={setSearchableValue}
                        options={FRUIT_OPTIONS}
                        placeholder="Select a fruit"
                        disabled={disabled}
                        aria-invalid={ariaInvalid}
                    />
                </div>
            </div>
        </Harness>
    );
}
