/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SkillCheckResultOption, SkillCheckResultValue } from "@/lib/schemas/skill-check";

import { SkillTrack_CheckRow } from "./check-row";

const OPTIONS: SkillCheckResultOption[] = [
    { value: "Fail", label: "Not Yet" },
    { value: "Pass", label: "Competent" },
];

const LABELS: Partial<Record<SkillCheckResultValue, string>> = {
    Fail: "Not Yet",
    Pass: "Competent",
};
const resultLabel = (value: SkillCheckResultValue) => LABELS[value] ?? value;

type RowProps = ComponentProps<typeof SkillTrack_CheckRow>;

function renderRow(props: Partial<RowProps> = {}) {
    const onOpenDialog = vi.fn();
    render(
        <SkillTrack_CheckRow
            title="CPR"
            check={null}
            pending={undefined}
            mode="dialog"
            resultOptions={OPTIONS}
            resultLabel={resultLabel}
            onRecord={vi.fn()}
            onRemove={vi.fn()}
            onOpenDialog={onOpenDialog}
            {...props}
        />,
    );
    return { onOpenDialog };
}

describe("SkillTrack_CheckRow (dialog mode)", () => {
    it("shows Not recorded and an Add button that opens the dialog compact", async () => {
        const { onOpenDialog } = renderRow();

        expect(screen.getByText("Not recorded")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Add check" }));
        expect(onOpenDialog).toHaveBeenCalledExactlyOnceWith("compact");
    });

    it("shows the check's org label, a notes indicator and an Edit button", () => {
        renderRow({ check: { result: "Pass", notes: "Good compressions" } });

        expect(screen.getByText("Competent")).toBeInTheDocument();
        expect(screen.getByLabelText("Has notes")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Edit check" })).toBeEnabled();
    });

    it("shows a pending value with the button disabled", () => {
        renderRow({ check: { result: "Pass", notes: "" }, pending: "Fail" });

        expect(screen.getByText("Not Yet")).toBeInTheDocument();
        expect(screen.queryByText("Competent")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Edit check" })).toBeDisabled();
    });

    it("shows a pending delete as Not recorded", () => {
        renderRow({ check: { result: "Pass", notes: "Some notes" }, pending: null });

        expect(screen.getByText("Not recorded")).toBeInTheDocument();
        expect(screen.queryByLabelText("Has notes")).not.toBeInTheDocument();
    });
});

describe("SkillTrack_CheckRow (quick mode)", () => {
    function renderQuick(props: Partial<RowProps> = {}) {
        const onRecord = vi.fn();
        const onRemove = vi.fn();
        const { onOpenDialog } = renderRow({ mode: "quick", onRecord, onRemove, ...props });
        return { onRecord, onRemove, onOpenDialog };
    }

    it("records the mid tier when an inactive button is tapped, keeping notes", async () => {
        const { onRecord } = renderQuick({ check: { result: "Fail", notes: "Keep" } });

        await userEvent.click(screen.getByRole("button", { name: "Competent" }));
        expect(onRecord).toHaveBeenCalledExactlyOnceWith({ result: "Pass", notes: "Keep" });
    });

    it("falls back to the first enabled tier when the mid tier is disabled", async () => {
        const { onRecord } = renderQuick({
            resultOptions: [
                { value: "HighFail", label: "Nearly" },
                { value: "WeakPass", label: "Weak" },
                { value: "StrongPass", label: "Strong" },
            ],
        });

        await userEvent.click(screen.getByRole("button", { name: "Competent" }));
        expect(onRecord).toHaveBeenCalledExactlyOnceWith({ result: "WeakPass", notes: "" });
    });

    it("omits a family's button when none of its tiers is enabled", () => {
        renderQuick({ resultOptions: [{ value: "Pass", label: "Competent" }] });

        expect(screen.queryByRole("button", { name: "Not Yet Competent" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Competent" })).toBeInTheDocument();
    });

    it("marks the family active for any of its tiers, even a disabled one", () => {
        renderQuick({ check: { result: "StrongPass", notes: "" } });

        expect(screen.getByRole("button", { name: "Competent" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        expect(screen.getByRole("button", { name: "Not Yet Competent" })).toHaveAttribute(
            "aria-pressed",
            "false",
        );
    });

    it("clears the check when the active button is tapped and there are no notes", async () => {
        const { onRemove, onRecord } = renderQuick({ check: { result: "Pass", notes: "" } });

        await userEvent.click(screen.getByRole("button", { name: "Competent" }));
        expect(onRemove).toHaveBeenCalledOnce();
        expect(onRecord).not.toHaveBeenCalled();
    });

    it("opens the dialog expanded instead of clearing a check with notes", async () => {
        const { onRemove, onOpenDialog } = renderQuick({
            check: { result: "Pass", notes: "Good compressions" },
        });

        expect(screen.getByLabelText("Has notes")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Competent" }));
        expect(onOpenDialog).toHaveBeenCalledExactlyOnceWith("expanded");
        expect(onRemove).not.toHaveBeenCalled();
    });

    it("shows another result's label in place of the buttons, with More", async () => {
        const { onOpenDialog } = renderQuick({ check: { result: "NotTaught", notes: "" } });

        expect(screen.getByText("NotTaught")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Competent" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "More options" }));
        expect(onOpenDialog).toHaveBeenCalledExactlyOnceWith("expanded");
    });

    it("disables its buttons while a write is pending", () => {
        renderQuick({ check: null, pending: "Pass" });

        expect(screen.getByRole("button", { name: "Competent" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "More options" })).toBeDisabled();
    });
});
