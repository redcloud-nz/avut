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
    StrongPass: "Excellent",
};
const resultLabel = (value: SkillCheckResultValue) => LABELS[value] ?? value;

type RowProps = ComponentProps<typeof SkillTrack_CheckRow>;

function renderRow(props: Partial<RowProps> = {}) {
    const onRecord = vi.fn();
    const onRemove = vi.fn();
    const onOpenDialog = vi.fn();
    render(
        <SkillTrack_CheckRow
            title="CPR"
            check={null}
            pending={undefined}
            resultOptions={OPTIONS}
            resultLabel={resultLabel}
            onRecord={onRecord}
            onRemove={onRemove}
            onOpenDialog={onOpenDialog}
            {...props}
        />,
    );
    return { onRecord, onRemove, onOpenDialog };
}

describe("SkillTrack_CheckRow", () => {
    it("lists the other assessors' checks under the title with the org's labels", () => {
        renderRow({
            otherChecks: [
                { assessorName: "Bob", result: "Fail" },
                { assessorName: "Jane", result: "StrongPass" },
            ],
        });

        expect(screen.getByText("CPR")).toBeInTheDocument();
        expect(
            screen.getByText("Also checked by Bob (Not Yet), Jane (Excellent)"),
        ).toBeInTheDocument();
    });

    it("shows no marker when there are no other checks", () => {
        renderRow({ otherChecks: [] });

        expect(screen.queryByText(/Also checked by/)).not.toBeInTheDocument();
    });

    it("records the mid tier when an inactive button is tapped, keeping notes", async () => {
        const { onRecord } = renderRow({ check: { result: "Fail", notes: "Keep" } });

        await userEvent.click(screen.getByRole("button", { name: "Competent" }));
        expect(onRecord).toHaveBeenCalledExactlyOnceWith({ result: "Pass", notes: "Keep" });
    });

    it("falls back to the first enabled tier when the mid tier is disabled", async () => {
        const { onRecord } = renderRow({
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
        renderRow({ resultOptions: [{ value: "Pass", label: "Competent" }] });

        expect(screen.queryByRole("button", { name: "Not Yet Competent" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Competent" })).toBeInTheDocument();
    });

    it("marks only the button whose result was recorded as active", () => {
        renderRow({ check: { result: "Pass", notes: "" } });

        expect(screen.getByRole("button", { name: "Competent" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        expect(screen.getByRole("button", { name: "Not Yet Competent" })).toHaveAttribute(
            "aria-pressed",
            "false",
        );
    });

    it("shows another tier's label in place of the buttons", () => {
        renderRow({ check: { result: "StrongPass", notes: "" } });

        expect(screen.getByText("Excellent")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Competent" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "More options" })).toBeInTheDocument();
    });

    it("shows a non-pass/fail result's label in place of the buttons, with More", async () => {
        const { onOpenDialog } = renderRow({ check: { result: "NotTaught", notes: "" } });

        expect(screen.getByText("NotTaught")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Competent" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "More options" }));
        expect(onOpenDialog).toHaveBeenCalledOnce();
    });

    it("clears the check when the active button is tapped and there are no notes", async () => {
        const { onRemove, onRecord } = renderRow({ check: { result: "Pass", notes: "" } });

        await userEvent.click(screen.getByRole("button", { name: "Competent" }));
        expect(onRemove).toHaveBeenCalledOnce();
        expect(onRecord).not.toHaveBeenCalled();
    });

    it("opens the dialog instead of clearing a check with notes", async () => {
        const { onRemove, onOpenDialog } = renderRow({
            check: { result: "Pass", notes: "Good compressions" },
        });

        expect(screen.getByLabelText("Has notes")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Competent" }));
        expect(onOpenDialog).toHaveBeenCalledOnce();
        expect(onRemove).not.toHaveBeenCalled();
    });

    it("shows a pending value with its buttons disabled", () => {
        renderRow({ check: { result: "Fail", notes: "" }, pending: "Pass" });

        const pass = screen.getByRole("button", { name: "Competent" });
        expect(pass).toHaveAttribute("aria-pressed", "true");
        expect(pass).toBeDisabled();
        expect(screen.getByRole("button", { name: "More options" })).toBeDisabled();
    });

    it("disables every button, More included, but still shows the result when disabled", () => {
        renderRow({ check: { result: "Pass", notes: "" }, disabled: true });

        expect(screen.getByRole("button", { name: "Competent" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Competent" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        expect(screen.getByRole("button", { name: "Not Yet Competent" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "More options" })).toBeDisabled();
    });

    it("shows a pending delete as unrecorded, without the notes indicator", () => {
        renderRow({ check: { result: "Pass", notes: "Some notes" }, pending: null });

        expect(screen.getByRole("button", { name: "Competent" })).toHaveAttribute(
            "aria-pressed",
            "false",
        );
        expect(screen.queryByLabelText("Has notes")).not.toBeInTheDocument();
    });
});
