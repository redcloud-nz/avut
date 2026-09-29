/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SkillCheckResultOption, SkillCheckResultValue } from "@/lib/schemas/skill-check";

import { SkillTrack_RecordCheckDialog } from "./record-check-dialog";

const OPTIONS: SkillCheckResultOption[] = [
    { value: "NotTaught", label: "Not Taught" },
    { value: "Fail", label: "Not Yet" },
    { value: "Pass", label: "Competent" },
];

/** The org's label for every result, including ones it hasn't enabled. */
const ORG_LABELS: Partial<Record<SkillCheckResultValue, string>> = {
    StrongPass: "Excellent",
};
const resultLabel = (value: SkillCheckResultValue) => ORG_LABELS[value] ?? value;

type DialogProps = ComponentProps<typeof SkillTrack_RecordCheckDialog>;

function renderDialog(props: Partial<DialogProps> = {}) {
    const handlers = {
        onOpenChange: vi.fn(),
        onRecord: vi.fn(),
        onDelete: vi.fn(),
    };
    const element = (overrides: Partial<DialogProps>) => (
        <SkillTrack_RecordCheckDialog
            open
            initialDensity="compact"
            targetKey="alice::cpr"
            skillName="CPR"
            personName="Alice"
            current={null}
            resultOptions={OPTIONS}
            resultLabel={resultLabel}
            {...handlers}
            {...props}
            {...overrides}
        />
    );
    const { rerender } = render(element({}));
    return {
        ...handlers,
        rerender: (overrides: Partial<DialogProps>) => rerender(element(overrides)),
    };
}

describe("SkillTrack_RecordCheckDialog", () => {
    it("titles the dialog with the skill and person", () => {
        renderDialog();

        expect(screen.getByRole("dialog", { name: "CPR" })).toBeInTheDocument();
        expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    it("renders only the enabled results", () => {
        renderDialog();

        expect(screen.getByRole("button", { name: "Not Taught" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Not Yet" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Competent" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Strong Pass" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Low Fail" })).not.toBeInTheDocument();
    });

    it("still shows the current result, with the org's label, when the org has since disabled it", () => {
        renderDialog({ current: { result: "StrongPass", notes: "" } });

        expect(screen.getByRole("button", { name: "Excellent" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );
    });

    it("records and closes on a compact tap, keeping existing notes", async () => {
        const user = userEvent.setup();
        const { onRecord, onOpenChange } = renderDialog({
            current: { result: "Fail", notes: "Slow start" },
        });

        await user.click(screen.getByRole("button", { name: "Competent" }));

        expect(onRecord).toHaveBeenCalledExactlyOnceWith({ result: "Pass", notes: "Slow start" });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("closes without recording when the current result is tapped", async () => {
        const user = userEvent.setup();
        const { onRecord, onOpenChange } = renderDialog({
            current: { result: "Pass", notes: "" },
        });

        await user.click(screen.getByRole("button", { name: "Competent" }));

        expect(onRecord).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("has no footer while compact", () => {
        renderDialog({ current: { result: "Pass", notes: "" } });

        expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    });

    it("expands in place, stages a result and notes, and saves them once", async () => {
        const user = userEvent.setup();
        const { onRecord, onOpenChange } = renderDialog();

        await user.click(screen.getByRole("button", { name: "Notes & more" }));

        const save = screen.getByRole("button", { name: "Save" });
        expect(save).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "Not Yet" }));
        expect(onRecord).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Not Yet" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );

        await user.type(screen.getByRole("textbox", { name: "Notes" }), "Needs practice");
        await user.click(save);

        expect(onRecord).toHaveBeenCalledExactlyOnceWith({
            result: "Fail",
            notes: "Needs practice",
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("keeps Save disabled until the staged pair differs from the current check", async () => {
        const user = userEvent.setup();
        renderDialog({
            initialDensity: "expanded",
            current: { result: "Pass", notes: "Good" },
        });

        const save = screen.getByRole("button", { name: "Save" });
        expect(save).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "Competent" }));
        expect(save).toBeDisabled();

        await user.type(screen.getByRole("textbox", { name: "Notes" }), "!");
        expect(save).toBeEnabled();
    });

    it("deletes and closes from the expanded footer", async () => {
        const user = userEvent.setup();
        const { onDelete, onRecord, onOpenChange } = renderDialog({
            initialDensity: "expanded",
            current: { result: "Pass", notes: "" },
        });

        await user.click(screen.getByRole("button", { name: "Delete" }));

        expect(onDelete).toHaveBeenCalledOnce();
        expect(onRecord).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("offers no Delete when there's no check", () => {
        renderDialog({ initialDensity: "expanded" });

        expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    });

    it("reopens compact with nothing staged after closing an expanded, edited dialog", async () => {
        const user = userEvent.setup();
        const { rerender } = renderDialog();

        await user.click(screen.getByRole("button", { name: "Notes & more" }));
        await user.click(screen.getByRole("button", { name: "Competent" }));
        await user.type(screen.getByRole("textbox", { name: "Notes" }), "Draft");

        rerender({ open: false });
        rerender({ open: true, initialDensity: "compact" });

        expect(screen.getByRole("button", { name: "Notes & more" })).toBeInTheDocument();
        expect(screen.queryByRole("textbox", { name: "Notes" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Competent" })).toHaveAttribute(
            "aria-pressed",
            "false",
        );

        await user.click(screen.getByRole("button", { name: "Notes & more" }));
        expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("");
    });

    it("discards staged changes on Cancel", async () => {
        const user = userEvent.setup();
        const { onRecord, onOpenChange } = renderDialog({ initialDensity: "expanded" });

        await user.click(screen.getByRole("button", { name: "Competent" }));
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onRecord).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
