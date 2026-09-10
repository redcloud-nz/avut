/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { PersonPicker } from "@/components/controls/person-picker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { useOrganization } from "@/hooks/use-organization";
import { PersonId } from "@/lib/schemas/person";

import { Harness } from "../_components/harness";

export function PersonPicker_Sandbox() {
    const organization = useOrganization();

    const [value, setValue] = useState<PersonId | null>(null);
    const [disabled, setDisabled] = useState(false);
    const [placeholder, setPlaceholder] = useState("Select a person");

    const code = [
        `<PersonPicker`,
        `    value={${value ? `"${value}"` : "null"}}`,
        `    onValueChange={setValue}`,
        `    organizationId={organization.id}`,
        ...(disabled ? [`    disabled`] : []),
        ...(placeholder !== "Select a person"
            ? [`    placeholder=${JSON.stringify(placeholder)}`]
            : []),
        `/>`,
    ].join("\n");

    return (
        <Harness
            title="Person picker"
            description="Org-scoped personnel picker. Reads the current organization from useOrganization() and the personnel.listPersonnel query."
            onReset={() => {
                setValue(null);
                setDisabled(false);
                setPlaceholder("Select a person");
            }}
            controls={
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Switch id="pp-disabled" checked={disabled} onCheckedChange={setDisabled} />
                        <Label htmlFor="pp-disabled">Disabled</Label>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="pp-placeholder">Placeholder</Label>
                        <input
                            id="pp-placeholder"
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={placeholder}
                            onChange={(e) => setPlaceholder(e.target.value)}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Selected: <code>{value ?? "null"}</code>
                    </p>
                </div>
            }
            code={code}
        >
            <PersonPicker
                value={value}
                onValueChange={setValue}
                organizationId={organization.id}
                disabled={disabled}
                placeholder={placeholder}
            />
        </Harness>
    );
}
