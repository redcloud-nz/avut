/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { trpc } from "@/trpc/client";
import type { MutationEffect } from "@/trpc/mutation-effector";

import { settingsEffects } from "./settings-effects";

describe("settingsEffects.updateOrganizationSettingsSlice", () => {
    const organizationId = OrganizationId.create();
    const queryKey = trpc.settings.getOrganizationSettings.queryKey({ organizationId });

    /** Applies the effects' write to `getOrganizationSettings` over `cached`, as the effector would. */
    function applyWrite(effects: MutationEffect[], cached: OrganizationSettings | undefined) {
        const writes = effects.filter(
            (e) => e.type === "write" && JSON.stringify(e.queryKey) === JSON.stringify(queryKey),
        ) as Extract<MutationEffect, { type: "write" }>[];
        expect(writes).toHaveLength(1);
        const [effect] = writes;
        return typeof effect.data === "function" ? effect.data(cached) : effect.data;
    }

    function withPersonnel(personnel: OrganizationSettings["personnel"]): OrganizationSettings {
        return { ...OrganizationSettings.default(), personnel };
    }

    it("takes only the patched fields from a response that resolves out of order", () => {
        // Flip A (autoLinkOnInviteAccept → true), then flip B (autoLinkOnPersonCreate → true). B's
        // response lands first; A's, which predates B, still says autoLinkOnPersonCreate: false.
        const afterB = withPersonnel({
            autoLinkOnInviteAccept: true,
            autoLinkOnPersonCreate: true,
        });
        const staleA = withPersonnel({
            autoLinkOnInviteAccept: true,
            autoLinkOnPersonCreate: false,
        });

        const effects = settingsEffects.updateOrganizationSettingsSlice(
            {
                organizationId,
                update: { slice: "personnel", patch: { autoLinkOnInviteAccept: true } },
            },
            staleA,
        );

        expect(applyWrite(effects, afterB)).toEqual(afterB);
    });

    it("leaves other slices as cached", () => {
        const cached = OrganizationSettings.default();
        cached.modules["d4h-i3"].enabled = true;
        const response = OrganizationSettings.default();
        response.modules.notes.enabled = true;

        const effects = settingsEffects.updateOrganizationSettingsSlice(
            { organizationId, update: { slice: "modules.notes", patch: { enabled: true } } },
            response,
        );
        const result = applyWrite(effects, cached) as OrganizationSettings;

        expect(result.modules.notes.enabled).toBe(true);
        expect(result.modules["d4h-i3"].enabled).toBe(true);
    });

    it("takes `enabled` of modules that require the patched module from the response", () => {
        // D4H I3 requires D4H, so saving D4H off turns D4H I3 off on the server too.
        const cached = OrganizationSettings.default();
        cached.modules.d4h.enabled = true;
        cached.modules["d4h-i3"].enabled = true;
        cached.modules.notes.enabled = true;
        const response = OrganizationSettings.default();

        const effects = settingsEffects.updateOrganizationSettingsSlice(
            { organizationId, update: { slice: "modules.d4h", patch: { enabled: false } } },
            response,
        );
        const result = applyWrite(effects, cached) as OrganizationSettings;

        expect(result.modules.d4h.enabled).toBe(false);
        expect(result.modules["d4h-i3"].enabled).toBe(false);
        // Only `enabled` of the dependent, and nothing of unrelated modules.
        expect(result.modules["d4h-i3"].storage).toBe(cached.modules["d4h-i3"].storage);
        expect(result.modules.notes.enabled).toBe(true);
    });

    it("leaves dependents as cached when the patch doesn't turn the module off", () => {
        // Enable D4H, then quickly enable D4H I3. D4H's response predates the second save, so it
        // still says D4H I3 is off.
        const cached = OrganizationSettings.default();
        cached.modules.d4h.enabled = true;
        cached.modules["d4h-i3"].enabled = true;
        const staleD4H = OrganizationSettings.default();
        staleD4H.modules.d4h.enabled = true;

        const effects = settingsEffects.updateOrganizationSettingsSlice(
            { organizationId, update: { slice: "modules.d4h", patch: { enabled: true } } },
            staleD4H,
        );
        const result = applyWrite(effects, cached) as OrganizationSettings;

        expect(result.modules.d4h.enabled).toBe(true);
        expect(result.modules["d4h-i3"].enabled).toBe(true);
    });

    it("writes the whole response when nothing is cached", () => {
        const response = OrganizationSettings.default();

        const effects = settingsEffects.updateOrganizationSettingsSlice(
            { organizationId, update: { slice: "rubbishBin", patch: { retentionDays: 10 } } },
            response,
        );

        expect(applyWrite(effects, undefined)).toBe(response);
    });
});
