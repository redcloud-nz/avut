/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";

import { PreferencesClient, usePreferences } from "@/hooks/use-preferences";
import { UserSettings } from "@/lib/schemas/user-settings";

import { DLDateDetails } from "./description-list-date";

/*
 * `usePreferences` is a `useSuspenseQuery` over a tRPC route, so it's stubbed rather than
 * driven through a query client — the behaviour under test is that the component reads the
 * viewer's presets at all, not how the settings are fetched.
 */
vi.mock("@/hooks/use-preferences", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/hooks/use-preferences")>()),
    usePreferences: vi.fn(),
}));

/** Local-time components, so the rendering is stable whatever zone the test process is in. */
const CREATED_AT = new Date(2026, 8, 24, 14, 30);

function givenPreferences(display: Partial<UserSettings["display"]>) {
    const settings = UserSettings.default();
    vi.mocked(usePreferences).mockReturnValue(
        new PreferencesClient({ ...settings, display: { ...settings.display, ...display } }),
    );
}

describe("DLDateDetails", () => {
    beforeEach(() => vi.mocked(usePreferences).mockReset());

    it("renders the timestamp using the viewer's presets", () => {
        givenPreferences({ dateFormat: "written", timeFormat: "12-hour" });
        render(<DLDateDetails date={CREATED_AT} />);

        expect(screen.getByText("24 Sep 2026 2:30 PM")).toBeInTheDocument();
    });

    it("follows a change of preset rather than a hardcoded default", () => {
        givenPreferences({ dateFormat: "slash", timeFormat: "24-hour" });
        const { rerender } = render(<DLDateDetails date={CREATED_AT} />);
        expect(screen.getByText("24/09/2026 14:30")).toBeInTheDocument();

        givenPreferences({ dateFormat: "dot", timeFormat: "24-hour" });
        rerender(<DLDateDetails date={CREATED_AT} />);
        expect(screen.getByText("24.09.2026 14:30")).toBeInTheDocument();
    });

    it("still renders the relative line, which takes no preference", () => {
        givenPreferences({ dateFormat: "iso-extended" });
        render(<DLDateDetails date={new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)} />);

        expect(screen.getByText("3 days ago")).toBeInTheDocument();
    });
});
