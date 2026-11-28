/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { describe, expect, it, vi } from "vitest";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { MenuActionProps } from "./menu-action";
import { ActionsCard, RecordCardEditButton, RecordCardMenu } from "./record-card-actions";

const icon = <span />;

// `Mod` is Ctrl off Mac, which is what jsdom reports.
function pressModPeriod() {
    act(() => {
        fireEvent.keyDown(document, { key: ".", code: "Period", ctrlKey: true });
    });
}

function pressAlt(key: string, code: string) {
    fireEvent.keyDown(document, { key, code, altKey: true });
}

describe("RecordCardMenu", () => {
    it("renders nothing with no actions and nothing after", () => {
        const { container } = render(<RecordCardMenu actions={[]} category="Thing" primary />);

        expect(container).toBeEmptyDOMElement();
    });

    it("renders a trigger when only `after` has content", () => {
        render(<RecordCardMenu actions={[]} category="Thing" after={<div>D4H</div>} />);

        expect(screen.getByRole("button", { name: "Actions" })).toBeInTheDocument();
    });

    it("registers the verb shortcuts only when primary", () => {
        const archive = vi.fn();
        const actions: MenuActionProps[] = [
            { verb: "archive", label: "Archive", icon, onSelect: archive },
        ];

        const { unmount } = render(<RecordCardMenu actions={actions} category="Thing" />);
        pressAlt("a", "KeyA");
        expect(archive).not.toHaveBeenCalled();
        unmount();

        render(<RecordCardMenu actions={actions} category="Thing" primary />);
        pressAlt("a", "KeyA");
        expect(archive).toHaveBeenCalledOnce();
    });

    it("opens on Mod+. with the first enabled item focused when primary", async () => {
        const actions: MenuActionProps[] = [
            { verb: "export", label: "Export", icon, onSelect: () => {}, disabled: true },
            { verb: "archive", label: "Archive", icon, onSelect: () => {} },
            { verb: "delete", label: "Delete", icon, onSelect: () => {} },
        ];
        render(<RecordCardMenu actions={actions} category="Thing" primary />);

        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        pressModPeriod();

        expect(await screen.findByRole("menu")).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByRole("menuitem", { name: /Archive/ })).toHaveFocus(),
        );
    });

    it("ignores Mod+. when not primary", () => {
        render(
            <RecordCardMenu
                actions={[{ verb: "delete", label: "Delete", icon, onSelect: () => {} }]}
                category="Thing"
            />,
        );

        pressModPeriod();

        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
});

describe("RecordCardEditButton", () => {
    it("clicks itself on Alt+E when primary", () => {
        const onClick = vi.fn();
        render(<RecordCardEditButton label="Edit thing" primary onClick={onClick} />);

        pressAlt("e", "KeyE");

        expect(onClick).toHaveBeenCalledOnce();
    });

    it("ignores Alt+E when not primary", () => {
        const onClick = vi.fn();
        render(<RecordCardEditButton label="Edit thing" onClick={onClick} />);

        pressAlt("e", "KeyE");

        expect(onClick).not.toHaveBeenCalled();
    });

    it("forwards its ref and renders inside a child link with asChild", () => {
        const ref = { current: null as HTMLButtonElement | null };
        render(
            <RecordCardEditButton label="Edit thing" asChild>
                <a href="/edit" />
            </RecordCardEditButton>,
        );
        render(<RecordCardEditButton label="Edit other" ref={ref} />);

        expect(screen.getByRole("link", { name: "Edit thing" })).toHaveAttribute("href", "/edit");
        expect(ref.current).toBe(screen.getByRole("button", { name: "Edit other" }));
    });
});

describe("ActionsCard", () => {
    it("renders nothing when it has no buttons", () => {
        const { container } = render(
            <ActionsCard title="Record">
                {null}
                {false}
            </ActionsCard>,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it("renders the title, description and buttons", () => {
        render(
            <ActionsCard title="Review" description="Check coverage.">
                <button>Review</button>
            </ActionsCard>,
        );

        expect(screen.getByText("Check coverage.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
    });
});
