/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { useState } from "react";
import { describe, expect, it } from "vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SkillCheckResultValue } from "@/lib/schemas/skill-check";

import { SkillTrack_AssessmentRow } from "./assessment-row";

type Value = { result: SkillCheckResultValue | null; notes: string };
type ResultOption = { value: SkillCheckResultValue; label: string };

/** Owns `value` state so clicks produce visible, re-rendered changes like a real caller would see. */
function Harness({ initial, resultOptions }: { initial: Value; resultOptions: ResultOption[] }) {
    const [value, setValue] = useState<Value>(initial);
    return (
        <SkillTrack_AssessmentRow
            title="CPR"
            value={value}
            onValueChange={setValue}
            resultOptions={resultOptions}
        />
    );
}

const DEFAULT_OPTIONS: ResultOption[] = [
    { value: "NotTaught", label: "Not Taught" },
    { value: "Fail", label: "Fail" },
    { value: "Pass", label: "Pass" },
    { value: "StrongPass", label: "Strong Pass" },
];

const ALL_TIER_OPTIONS: ResultOption[] = [
    { value: "NotTaught", label: "Not Taught" },
    { value: "LowFail", label: "Low Fail" },
    { value: "Fail", label: "Fail" },
    { value: "HighFail", label: "High Fail" },
    { value: "WeakPass", label: "Weak Pass" },
    { value: "Pass", label: "Pass" },
    { value: "StrongPass", label: "Strong Pass" },
];

/** Opens the "..." dropdown and returns the label of whichever result option is checked. */
async function openMenuAndReadChecked(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "More result options" }));
    const items = screen.getAllByRole("menuitemcheckbox");
    const checked = items.find((item) => item.getAttribute("aria-checked") === "true");
    const label = checked?.textContent ?? null;
    await user.keyboard("{Escape}");
    return label;
}

describe("SkillTrack_AssessmentRow", () => {
    it("shows the fail/pass buttons and no notes button when unset", () => {
        render(<Harness initial={{ result: null, notes: "" }} resultOptions={DEFAULT_OPTIONS} />);

        expect(screen.getByRole("button", { name: "Not Yet Competent" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Competent" })).toBeInTheDocument();
        expect(screen.queryByPlaceholderText("Notes...")).not.toBeInTheDocument();
    });

    it("shows the value's label instead of quick buttons for non-tier values", () => {
        render(
            <Harness
                initial={{ result: "NotTaught", notes: "" }}
                resultOptions={DEFAULT_OPTIONS}
            />,
        );

        expect(screen.getByText("Not Taught")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Not Yet Competent" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Competent" })).not.toBeInTheDocument();
    });

    it("clicking the Fail button lands on the mid tier first, then cycles through enabled tiers, wrapping around", async () => {
        const user = userEvent.setup();
        render(<Harness initial={{ result: null, notes: "" }} resultOptions={ALL_TIER_OPTIONS} />);

        const failButton = screen.getByRole("button", { name: "Not Yet Competent" });

        await user.click(failButton);
        expect(await openMenuAndReadChecked(user)).toBe("Fail");

        await user.click(failButton);
        expect(await openMenuAndReadChecked(user)).toBe("High Fail");

        await user.click(failButton);
        expect(await openMenuAndReadChecked(user)).toBe("Low Fail");

        await user.click(failButton);
        expect(await openMenuAndReadChecked(user)).toBe("Fail");
    });

    it("clicking the Pass button cycles Weak -> Pass -> Strong -> Weak", async () => {
        const user = userEvent.setup();
        render(<Harness initial={{ result: null, notes: "" }} resultOptions={ALL_TIER_OPTIONS} />);

        const passButton = screen.getByRole("button", { name: "Competent" });

        await user.click(passButton);
        expect(await openMenuAndReadChecked(user)).toBe("Pass");

        await user.click(passButton);
        expect(await openMenuAndReadChecked(user)).toBe("Strong Pass");

        await user.click(passButton);
        expect(await openMenuAndReadChecked(user)).toBe("Weak Pass");
    });

    it("skips disabled tiers, landing on the first enabled tier when the mid tier isn't enabled", async () => {
        const user = userEvent.setup();
        const options: ResultOption[] = [
            { value: "LowFail", label: "Low Fail" },
            { value: "HighFail", label: "High Fail" },
        ];
        render(<Harness initial={{ result: null, notes: "" }} resultOptions={options} />);

        const failButton = screen.getByRole("button", { name: "Not Yet Competent" });

        await user.click(failButton);
        expect(await openMenuAndReadChecked(user)).toBe("Low Fail");

        await user.click(failButton);
        expect(await openMenuAndReadChecked(user)).toBe("High Fail");
    });

    it("behaves as a plain toggle when only one tier in the family is enabled", async () => {
        const user = userEvent.setup();
        const options: ResultOption[] = [{ value: "Fail", label: "Fail" }];
        render(<Harness initial={{ result: null, notes: "" }} resultOptions={options} />);

        const failButton = screen.getByRole("button", { name: "Not Yet Competent" });

        await user.click(failButton);
        expect(await openMenuAndReadChecked(user)).toBe("Fail");

        await user.click(failButton);
        expect(await openMenuAndReadChecked(user)).toBe("Fail");
    });

    it("selects a value directly from the dropdown", async () => {
        const user = userEvent.setup();
        render(<Harness initial={{ result: null, notes: "" }} resultOptions={ALL_TIER_OPTIONS} />);

        await user.click(screen.getByRole("button", { name: "More result options" }));
        await user.click(screen.getByRole("menuitemcheckbox", { name: "Strong Pass" }));

        expect(await openMenuAndReadChecked(user)).toBe("Strong Pass");
    });

    it("disables Remove when unset, and clears the result when clicked", async () => {
        const user = userEvent.setup();
        render(<Harness initial={{ result: null, notes: "" }} resultOptions={DEFAULT_OPTIONS} />);

        await user.click(screen.getByRole("button", { name: "More result options" }));
        expect(screen.getByRole("menuitem", { name: /Remove/ })).toHaveAttribute(
            "aria-disabled",
            "true",
        );
        await user.keyboard("{Escape}");

        await user.click(screen.getByRole("button", { name: "Not Yet Competent" }));
        expect(screen.getByRole("button", { name: "Competent" })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "More result options" }));
        const removeItem = screen.getByRole("menuitem", { name: /Remove/ });
        expect(removeItem).not.toHaveAttribute("aria-disabled", "true");
        await user.click(removeItem);

        expect(screen.queryByPlaceholderText("Notes...")).not.toBeInTheDocument();
    });

    it("shows the notes button once a result is set, and toggles the notes textarea", async () => {
        const user = userEvent.setup();
        render(<Harness initial={{ result: "Pass", notes: "" }} resultOptions={DEFAULT_OPTIONS} />);

        expect(screen.queryByPlaceholderText("Notes...")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Notes" }));
        const textarea = await screen.findByPlaceholderText("Notes...");
        expect(textarea).toBeInTheDocument();

        await user.type(textarea, "Great form");
        expect(textarea).toHaveValue("Great form");
    });
});
