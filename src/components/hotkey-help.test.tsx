/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useActionHotkeys } from "@/hooks/use-action-hotkeys";

import { HotkeyHelp } from "./hotkey-help";

/** Stand-in for a page that registers action shortcuts. */
function FakePage() {
    useActionHotkeys([
        { verb: "create", run: () => {}, name: "New thing", category: "Thing" },
        { verb: "update", run: () => {}, name: "Edit", category: "Thing" },
    ]);
    return null;
}

describe("HotkeyHelp", () => {
    it("renders nothing until opened", () => {
        // Regression guard: HotkeyHelp registers the `?` hotkey, so it must NOT
        // subscribe to the hotkey-manager store (via useHotkeyRegistrations) —
        // doing both re-renders forever because useHotkey writes to that store
        // on every render. If this test hangs, that coupling is back.
        const { container } = render(
            <>
                <FakePage />
                <HotkeyHelp />
            </>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("lists the active shortcuts, grouped, when toggled open with `?`", () => {
        render(
            <>
                <FakePage />
                <HotkeyHelp />
            </>,
        );

        fireEvent.keyDown(document, { key: "?", shiftKey: true });

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Thing")).toBeInTheDocument();
        expect(screen.getByText("New thing")).toBeInTheDocument();
        expect(screen.getByText("Edit")).toBeInTheDocument();
    });
});
