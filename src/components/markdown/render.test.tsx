/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { render, screen } from "@testing-library/react";

import { RenderMarkdown } from "./render";

describe("RenderMarkdown", () => {
    it("keeps the <u> the underline button saves", () => {
        const { container } = render(<RenderMarkdown markdown="<u>x</u>" />);
        expect(container.querySelector("u")).toHaveTextContent("x");
    });

    it("strips <script> and event-handler attributes", () => {
        const { container } = render(
            <RenderMarkdown
                markdown={'<script>alert(1)</script>\n\n<img src="x.png" onerror="alert(1)">'}
            />,
        );
        expect(container.querySelector("script")).toBeNull();
        const img = container.querySelector("img");
        expect(img).not.toBeNull();
        expect(img).not.toHaveAttribute("onerror");
    });

    it("removes <iframe> and <svg>", () => {
        const { container } = render(
            <RenderMarkdown
                markdown={'<iframe src="https://x"></iframe>\n\n<svg><circle r="1" /></svg>'}
            />,
        );
        expect(container.querySelector("iframe")).toBeNull();
        expect(container.querySelector("svg")).toBeNull();
    });

    it("strips inline styles", () => {
        const { container } = render(<RenderMarkdown markdown={'<p style="color:red">x</p>'} />);
        expect(container.querySelector("p")).not.toHaveAttribute("style");
    });

    it("strips data: image sources", () => {
        const { container } = render(
            <RenderMarkdown markdown={'<img src="data:image/png;base64,AAAA">'} />,
        );
        const img = container.querySelector("img");
        expect(img).not.toBeNull();
        expect(img).not.toHaveAttribute("src");
    });

    it("prefixes raw ids so they can't clobber page globals", () => {
        const { container } = render(<RenderMarkdown markdown={'<a id="x">x</a>'} />);
        expect(container.querySelector("a")).toHaveAttribute("id", "user-content-x");
    });

    it("still renders a GFM table and a link", () => {
        const markdown = [
            "| A | B |",
            "| :- | -: |",
            "| 1 | 2 |",
            "",
            "[AVUT](https://example.com)",
        ].join("\n");
        render(<RenderMarkdown markdown={markdown} />);

        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(screen.getAllByRole("columnheader")).toHaveLength(2);
        // Column alignment survives sanitizing; react-markdown turns `align` into an inline style.
        expect(screen.getByRole("cell", { name: "2" })).toHaveStyle({ textAlign: "right" });
        expect(screen.getByRole("link", { name: "AVUT" })).toHaveAttribute(
            "href",
            "https://example.com",
        );
    });
});
