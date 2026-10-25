/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Activity } from "react";
import { describe, expect, it } from "vitest";

import { fireEvent, render, screen } from "@testing-library/react";

import { useDismissedThisVisit } from "./use-dismissed-this-visit";

function Probe() {
    const [dismissed, setDismissed] = useDismissedThisVisit();
    return <button onClick={() => setDismissed(true)}>{dismissed ? "dismissed" : "open"}</button>;
}

function page(mode: "visible" | "hidden") {
    return (
        <Activity mode={mode}>
            <Probe />
        </Activity>
    );
}

describe("useDismissedThisVisit", () => {
    it("stays dismissed while the page is shown", () => {
        const { rerender } = render(page("visible"));
        fireEvent.click(screen.getByRole("button"));
        rerender(page("visible"));
        expect(screen.getByRole("button").textContent).toBe("dismissed");
    });

    it("resets when Activity hides the page, so a return counts as a fresh arrival", () => {
        const { rerender } = render(page("visible"));
        fireEvent.click(screen.getByRole("button"));
        rerender(page("hidden"));
        rerender(page("visible"));
        expect(screen.getByRole("button").textContent).toBe("open");
    });
});
