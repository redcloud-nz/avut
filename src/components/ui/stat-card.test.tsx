/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { UsersIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import { render, screen } from "@testing-library/react";

import { StatCard } from "./stat-card";

describe("StatCard", () => {
    it("links to the detail behind the number when given an href", () => {
        render(<StatCard icon={UsersIcon} value={12} label="Active Personnel" href="/user" />);

        expect(screen.getByRole("link", { name: /12.*Active Personnel/ })).toHaveAttribute(
            "href",
            "/user",
        );
    });

    it("renders a plain card, with no link, without an href", () => {
        render(<StatCard icon={UsersIcon} value={7} label="Current checks" />);

        expect(screen.getByText("Current checks")).toBeInTheDocument();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
});
