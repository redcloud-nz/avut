/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { render, screen } from "@testing-library/react";

import { MutationButton } from "./button";

const TEXT = { idle: "Save", pending: "Saving", success: "Saved" };

describe("MutationButton", () => {
    it("is enabled and shows the idle label while idle", () => {
        render(<MutationButton status="idle" text={TEXT} />);
        expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    it("is disabled while pending and while succeeding", () => {
        const { rerender } = render(<MutationButton status="pending" text={TEXT} />);
        expect(screen.getByRole("button")).toBeDisabled();

        rerender(<MutationButton status="success" text={TEXT} />);
        expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    });

    it("stays clickable after an error so the user can retry", () => {
        render(<MutationButton status="error" text={TEXT} />);
        expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    it("still honours an explicit disabled prop", () => {
        render(<MutationButton status="error" text={TEXT} disabled />);
        expect(screen.getByRole("button")).toBeDisabled();
    });
});
