/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OrganizationId } from "@/lib/schemas/organization";

import { Feature_SettingsCard } from "./feature-settings-card";
import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

vi.mock("./use-organization-settings-mutation", () => ({
    useOrganizationSettingsMutation: vi.fn(),
}));

const mockUseMutation = vi.mocked(useOrganizationSettingsMutation);
const mutate = vi.fn();

const ORG_ID = OrganizationId.create();

function renderCard({
    canEdit,
    enabled,
    search = "",
}: {
    canEdit: boolean;
    enabled: boolean;
    search?: string;
}) {
    return render(
        <NuqsTestingAdapter searchParams={search}>
            <Feature_SettingsCard
                organizationId={ORG_ID}
                canEdit={canEdit}
                slice="modules.notes"
                enabled={enabled}
                kind="module"
                title="Notes"
            />
        </NuqsTestingAdapter>,
    );
}

describe("Feature_SettingsCard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseMutation.mockReturnValue({
            mutate,
            reset: vi.fn(),
            status: "idle",
        } as unknown as ReturnType<typeof useOrganizationSettingsMutation>);
    });

    it("enables straight away, sending only the enabled flag", async () => {
        const user = userEvent.setup();
        renderCard({ canEdit: true, enabled: false });

        await user.click(screen.getByRole("button", { name: "Enable" }));

        expect(mutate).toHaveBeenCalledExactlyOnceWith({
            organizationId: ORG_ID,
            update: { slice: "modules.notes", patch: { enabled: true } },
        });
    });

    it("opens the disable dialog from ?action=disable-<key> while enabled", () => {
        renderCard({ canEdit: true, enabled: true, search: "?action=disable-notes" });

        expect(screen.getByRole("dialog", { name: "Disable the Notes?" })).toBeInTheDocument();
    });

    it("ignores ?action=disable-<key> while already disabled", () => {
        renderCard({ canEdit: true, enabled: false, search: "?action=disable-notes" });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("sends enabled: false when the disable is confirmed", async () => {
        const user = userEvent.setup();
        renderCard({ canEdit: true, enabled: true });

        await user.click(screen.getByRole("button", { name: "Disable" }));
        const dialog = screen.getByRole("dialog", { name: "Disable the Notes?" });
        await user.click(within(dialog).getByRole("button", { name: "Disable" }));

        expect(mutate).toHaveBeenCalledExactlyOnceWith({
            organizationId: ORG_ID,
            update: { slice: "modules.notes", patch: { enabled: false } },
        });
    });

    it("shows a viewer no Enable button", () => {
        renderCard({ canEdit: false, enabled: false });

        expect(screen.getByText("This module is not enabled for your organisation.")).toBeVisible();
        expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument();
    });

    it("shows a viewer no Disable button and no dialog, even with the action param set", () => {
        renderCard({ canEdit: false, enabled: true, search: "?action=disable-notes" });

        expect(screen.queryByRole("button", { name: "Disable" })).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
