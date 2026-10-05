/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { OrganizationSettings_UpdateD4HDefaultServer_Dialog } from "./update-d4h-default-server";
import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

vi.mock("./use-organization-settings-mutation", () => ({
    useOrganizationSettingsMutation: vi.fn(),
}));

const mockUseMutation = vi.mocked(useOrganizationSettingsMutation);
const mutate = vi.fn();

const ORG_ID = OrganizationId.create();

function renderDialog(search: string) {
    const defaults = OrganizationSettings.default();
    // A configured, enabled integration, so a patch that leaked the slice would carry these.
    const settings: OrganizationSettings = {
        ...defaults,
        integrations: {
            ...defaults.integrations,
            d4h: {
                ...defaults.integrations.d4h,
                enabled: true,
                defaultServer: "ap",
                syncToken: "sync-token",
            },
        },
    };

    return render(
        <NuqsTestingAdapter searchParams={search}>
            <OrganizationSettings_UpdateD4HDefaultServer_Dialog
                organizationId={ORG_ID}
                settings={settings}
                description="The D4H server new access tokens default to."
            />
        </NuqsTestingAdapter>,
    );
}

describe("OrganizationSettings_UpdateD4HDefaultServer_Dialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseMutation.mockReturnValue({
            mutate,
            reset: vi.fn(),
            status: "idle",
        } as unknown as ReturnType<typeof useOrganizationSettingsMutation>);
    });

    it("sends only the picked defaultServer", async () => {
        const user = userEvent.setup();
        renderDialog("?action=update-d4h-default-server");

        const dialog = screen.getByRole("dialog", { name: "D4H Default Server" });
        await user.click(within(dialog).getByRole("combobox", { name: "Default Server" }));
        await user.click(screen.getByRole("option", { name: "Europe" }));
        await user.click(within(dialog).getByRole("button", { name: "Save" }));

        expect(mutate).toHaveBeenCalledExactlyOnceWith({
            organizationId: ORG_ID,
            update: { slice: "integrations.d4h", patch: { defaultServer: "eu" } },
        });
    });

    it("stays closed for another action", () => {
        renderDialog("?action=update-rubbish-bin");

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
