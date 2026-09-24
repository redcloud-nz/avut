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

/*
 * A fixed instant plus an explicit zone on every expectation, rather than local-time components
 * — see the same note in `src/lib/datetime.test.ts`. The suite's process zone is deliberately
 * neither of the zones named here.
 */
const CREATED_AT = new Date("2026-02-02T22:36:00.000Z");
const NZ = "Pacific/Auckland";

function givenPreferences(display: Partial<UserSettings["display"]>) {
    const settings = UserSettings.default();
    vi.mocked(usePreferences).mockReturnValue(
        new PreferencesClient({ ...settings, display: { ...settings.display, ...display } }),
    );
}

describe("DLDateDetails", () => {
    beforeEach(() => vi.mocked(usePreferences).mockReset());

    it("renders the timestamp using the viewer's presets", () => {
        givenPreferences({ dateFormat: "written", timeFormat: "12-hour", timeZone: NZ });
        render(<DLDateDetails date={CREATED_AT} />);

        expect(screen.getByText("03 Feb 2026 11:36 AM")).toBeInTheDocument();
    });

    it("follows a change of preset rather than a hardcoded default", () => {
        givenPreferences({ dateFormat: "slash", timeFormat: "24-hour", timeZone: NZ });
        const { rerender } = render(<DLDateDetails date={CREATED_AT} />);
        expect(screen.getByText("03/02/2026 11:36")).toBeInTheDocument();

        givenPreferences({ dateFormat: "dot", timeFormat: "24-hour", timeZone: NZ });
        rerender(<DLDateDetails date={CREATED_AT} />);
        expect(screen.getByText("03.02.2026 11:36")).toBeInTheDocument();
    });

    it("still renders the relative line, which takes no preference", () => {
        givenPreferences({ dateFormat: "iso-extended", timeZone: NZ });
        render(<DLDateDetails date={new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)} />);

        expect(screen.getByText("3 days ago")).toBeInTheDocument();
    });
});
