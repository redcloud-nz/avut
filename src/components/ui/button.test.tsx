/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/utils";
import { Button } from "./button";

describe("Button Component", () => {
    test("renders button with text", () => {
        render(<Button>Click me</Button>);
        expect(
            screen.getByRole("button", { name: "Click me" }),
        ).toBeInTheDocument();
    });

    test("applies variant classes correctly", () => {
        render(<Button variant="ghost">Ghost Button</Button>);
        const button = screen.getByRole("button");
        expect(button).toHaveClass("hover:bg-accent");
    });

    test("applies size classes correctly", () => {
        render(<Button size="sm">Small Button</Button>);
        const button = screen.getByRole("button");
        expect(button).toHaveClass("h-8");
    });

    test("handles click events", () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Click me</Button>);

        fireEvent.click(screen.getByRole("button"));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test("can be disabled", () => {
        const handleClick = vi.fn();
        render(
            <Button disabled onClick={handleClick}>
                Disabled
            </Button>,
        );

        const button = screen.getByRole("button");
        expect(button).toBeDisabled();

        fireEvent.click(button);
        expect(handleClick).not.toHaveBeenCalled();
    });

    test("applies custom className", () => {
        render(<Button className="custom-class">Custom</Button>);
        const button = screen.getByRole("button");
        expect(button).toHaveClass("custom-class");
    });
});
