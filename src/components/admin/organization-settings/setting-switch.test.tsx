/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OrganizationId } from "@/lib/schemas/organization";

import { OrganizationSettings_SettingSwitch } from "./setting-switch";
import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

vi.mock("./use-organization-settings-mutation", () => ({
    useOrganizationSettingsMutation: vi.fn(),
}));

const mockUseMutation = vi.mocked(useOrganizationSettingsMutation);
const mutate = vi.fn();

// Radix's Switch measures its thumb with ResizeObserver, which jsdom doesn't provide.
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

const ORG_ID = OrganizationId.create();

function mockMutation(state: { status: string }) {
    mockUseMutation.mockReturnValue({ mutate, ...state } as unknown as ReturnType<
        typeof useOrganizationSettingsMutation
    >);
}

function renderSwitch({ value = false }: { value?: boolean } = {}) {
    return render(
        <OrganizationSettings_SettingSwitch
            organizationId={ORG_ID}
            slice="personnel"
            field="autoLinkOnInviteAccept"
            value={value}
            label="Link on invitation accept"
        />,
    );
}

describe("OrganizationSettings_SettingSwitch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMutation({ status: "idle" });
    });

    it("shows the stored value", () => {
        renderSwitch({ value: true });

        expect(screen.getByRole("switch", { name: "Link on invitation accept" })).toBeChecked();
    });

    it("saves a patch holding only its own field when flipped", async () => {
        const user = userEvent.setup();
        renderSwitch();

        await user.click(screen.getByRole("switch", { name: "Link on invitation accept" }));

        expect(mutate).toHaveBeenCalledExactlyOnceWith({
            organizationId: ORG_ID,
            update: { slice: "personnel", patch: { autoLinkOnInviteAccept: true } },
        });
    });

    it("shows the requested value, disabled, while the save is in flight", async () => {
        const user = userEvent.setup();
        const { rerender } = renderSwitch({ value: false });

        await user.click(screen.getByRole("switch", { name: "Link on invitation accept" }));
        mockMutation({ status: "pending" });
        rerender(
            <OrganizationSettings_SettingSwitch
                organizationId={ORG_ID}
                slice="personnel"
                field="autoLinkOnInviteAccept"
                value={false}
                label="Link on invitation accept"
            />,
        );

        const control = screen.getByRole("switch", { name: "Link on invitation accept" });
        expect(control).toBeChecked();
        expect(control).toBeDisabled();
    });

    it("rejects a field that isn't a boolean of the slice", () => {
        // Type-level only — never rendered.
        void (() => (
            <OrganizationSettings_SettingSwitch
                organizationId={ORG_ID}
                slice="personnel"
                // @ts-expect-error `enabled` belongs to the module slices, not `personnel`
                field="enabled"
                value={false}
                label="Wrong"
            />
        ));
        void (() => (
            <OrganizationSettings_SettingSwitch
                organizationId={ORG_ID}
                slice="rubbishBin"
                // @ts-expect-error `retentionDays` is a number, not a boolean
                field="retentionDays"
                value={false}
                label="Wrong"
            />
        ));
    });
});
