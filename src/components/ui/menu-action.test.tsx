/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { describe, expect, it, vi } from "vitest";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { EntityActionMenu, type MenuActionProps } from "./menu-action";

const icon = <span />;

describe("EntityActionMenu", () => {
    it("opens on Mod+. with the first enabled item focused", async () => {
        const actions: MenuActionProps[] = [
            { verb: "update", label: "Edit", icon, onSelect: () => {}, disabled: true },
            { verb: "publish", label: "Publish", icon, onSelect: () => {} },
            { verb: "delete", label: "Delete", icon, onSelect: () => {} },
        ];
        render(<EntityActionMenu actions={actions} category="Thing" />);

        expect(screen.queryByRole("menu")).not.toBeInTheDocument();

        // `Mod` is Ctrl off Mac, which is what jsdom reports.
        act(() => {
            fireEvent.keyDown(document, { key: ".", code: "Period", ctrlKey: true });
        });

        expect(await screen.findByRole("menu")).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByRole("menuitem", { name: /Publish/ })).toHaveFocus(),
        );
    });

    it("registers a shortcut only for verbs that have one", () => {
        const publish = vi.fn();
        const archive = vi.fn();
        render(
            <EntityActionMenu
                actions={[
                    { verb: "publish", label: "Publish", icon, onSelect: publish },
                    { verb: "archive", label: "Archive", icon, onSelect: archive },
                ]}
                category="Thing"
            />,
        );

        // Alt+P was `publish` before #380.
        fireEvent.keyDown(document, { key: "p", code: "KeyP", altKey: true });
        fireEvent.keyDown(document, { key: "a", code: "KeyA", altKey: true });

        expect(publish).not.toHaveBeenCalled();
        expect(archive).toHaveBeenCalledOnce();
    });
});
