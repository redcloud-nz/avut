/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    OrganizationSettings,
    OrganizationSettingsSliceId,
} from "@/lib/schemas/organization-settings";
import type { PathValue, SettingsSlicePatch } from "@/lib/schemas/settings-schema";

import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

/** The keys of slice `S` whose values are booleans — the only fields this switch can edit. */
export type BooleanSettingOf<S extends OrganizationSettingsSliceId> = {
    [K in keyof PathValue<OrganizationSettings, S>]: PathValue<
        OrganizationSettings,
        S
    >[K] extends boolean
        ? K
        : never;
}[keyof PathValue<OrganizationSettings, S>];

/**
 * An inline switch for one boolean organization setting, for `SettingRow`'s `value`. Flipping it
 * saves straight away — a patch holding only that field — so there's no dialog or Save button.
 * While the save is in flight the switch shows the requested value and is disabled; if it fails,
 * the toast fires and the switch falls back to the stored value.
 *
 * `field` is limited to the boolean keys of `slice`, so a mismatched slice/field pair fails to
 * typecheck. That matters because the server's patch schema is non-strict: an unknown key would
 * be dropped silently and the save would "succeed" without changing anything.
 */
export function OrganizationSettings_SettingSwitch<S extends OrganizationSettingsSliceId>({
    organizationId,
    slice,
    field,
    value,
    label,
}: {
    organizationId: OrganizationId;
    slice: S;
    field: BooleanSettingOf<S>;
    /** The setting's current value. */
    value: boolean;
    /** Accessible name for the switch — usually the row's title. */
    label: string;
}) {
    const mutation = useOrganizationSettingsMutation({
        errorMessage: `Failed to update "${label}"`,
        onSaved: () => {},
    });

    const [requested, setRequested] = useState(value);
    const pending = mutation.status === "pending";
    const checked = pending ? requested : value;

    function handleCheckedChange(next: boolean) {
        setRequested(next);
        mutation.mutate({
            organizationId,
            // TS can't correlate the generic `S` with the discriminated-union input, so the
            // `{ slice, patch }` pair is asserted here. `BooleanSettingOf<S>` on the props is
            // what guarantees `field` belongs to `slice`.
            update: { slice, patch: { [field]: next } } as SettingsSlicePatch<
                OrganizationSettings,
                OrganizationSettingsSliceId
            >,
        });
    }

    return (
        <Switch
            aria-label={label}
            checked={checked}
            disabled={pending}
            onCheckedChange={handleCheckedChange}
        />
    );
}
