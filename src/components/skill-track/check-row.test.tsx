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
