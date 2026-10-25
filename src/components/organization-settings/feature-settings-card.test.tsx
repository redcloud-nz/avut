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
        renderCard({ canEdit: true, enabled: true, search: "?action=disable-modules-notes" });

        expect(screen.getByRole("dialog", { name: "Disable the Notes?" })).toBeInTheDocument();
    });

    it("keeps the D4H integration's and D4H module's disable dialogs apart", () => {
        render(
            <NuqsTestingAdapter searchParams="?action=disable-modules-d4h">
                <Feature_SettingsCard
                    organizationId={ORG_ID}
                    canEdit
                    slice="integrations.d4h"
                    enabled
                    kind="integration"
                    title="D4H Integration"
                />
                <Feature_SettingsCard
                    organizationId={ORG_ID}
                    canEdit
                    slice="modules.d4h"
                    enabled
                    kind="module"
                    title="D4H Module"
                />
            </NuqsTestingAdapter>,
        );

        expect(screen.getByRole("dialog", { name: "Disable the D4H Module?" })).toBeInTheDocument();
        expect(
            screen.queryByRole("dialog", { name: "Disable the D4H Integration?" }),
        ).not.toBeInTheDocument();
    });

    it("ignores ?action=disable-<key> while already disabled", () => {
        renderCard({ canEdit: true, enabled: false, search: "?action=disable-modules-notes" });

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

        expect(screen.getByText("Disabled")).toBeVisible();
        expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument();
    });

    describe("a module that requires another (D4H I3 requires D4H)", () => {
        function renderI3({ enabled, d4hOn }: { enabled: boolean; d4hOn: boolean }) {
            return render(
                <NuqsTestingAdapter>
                    <Feature_SettingsCard
                        organizationId={ORG_ID}
                        canEdit
                        slice="modules.d4h-i3"
                        enabled={enabled}
                        isModuleEnabled={(id) => (id === "d4h" ? d4hOn : enabled)}
                        kind="module"
                        title="D4H I3 Module"
                    />
                </NuqsTestingAdapter>,
            );
        }

        it("holds Enable off and says why while the required module is off", () => {
            renderI3({ enabled: false, d4hOn: false });

            expect(screen.getByRole("button", { name: "Enable" })).toBeDisabled();
            expect(screen.getByText("Turn on D4H to use D4H I3.")).toBeVisible();
        });

        it("allows Enable once the required module is on", () => {
            renderI3({ enabled: false, d4hOn: true });

            expect(screen.getByRole("button", { name: "Enable" })).toBeEnabled();
            expect(screen.queryByText(/Turn on D4H/)).not.toBeInTheDocument();
        });

        it("marks a module left on as inactive, and keeps Disable", () => {
            renderI3({ enabled: true, d4hOn: false });

            expect(screen.getByText("Inactive until D4H is turned on.")).toBeVisible();
            expect(screen.getByRole("button", { name: "Disable" })).toBeEnabled();
        });
    });

    describe("a module that others require (D4H)", () => {
        function renderD4H(i3On: boolean) {
            return render(
                <NuqsTestingAdapter searchParams="?action=disable-modules-d4h">
                    <Feature_SettingsCard
                        organizationId={ORG_ID}
                        canEdit
                        slice="modules.d4h"
                        enabled
                        isModuleEnabled={(id) => id === "d4h" || (id === "d4h-i3" && i3On)}
                        kind="module"
                        title="D4H Module"
                    />
                </NuqsTestingAdapter>,
            );
        }

        it("warns in the disable dialog that an enabled dependent goes off too", () => {
            renderD4H(true);

            expect(screen.getByRole("dialog")).toHaveTextContent(
                "D4H I3 will be turned off too, and won't come back on by itself.",
            );
        });

        it("leaves the warning out when no dependent is on", () => {
            renderD4H(false);

            expect(screen.getByRole("dialog")).not.toHaveTextContent("turned off too");
        });
    });

    it("shows a viewer no Disable button and no dialog, even with the action param set", () => {
        renderCard({ canEdit: false, enabled: true, search: "?action=disable-modules-notes" });

        expect(screen.queryByRole("button", { name: "Disable" })).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
