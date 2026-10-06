/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it } from "vitest";

import { renderHook } from "@testing-library/react";

import { useReturnFocus } from "./use-return-focus";

function button(label: string) {
    const element = document.createElement("button");
    element.textContent = label;
    document.body.append(element);
    return element;
}

/** Opens the dialog with `opener` focused (or nothing, for `null`), then focuses inside it. */
function open(handlers: ReturnType<typeof useReturnFocus>, opener: HTMLElement | null) {
    if (opener) opener.focus();
    else (document.activeElement as HTMLElement | null)?.blur();
    handlers.onOpenAutoFocus();
    // Focus moves into the dialog while it's open.
    button("inside dialog").focus();
}

/** Closes the dialog; returns whether the hook took over from Radix's default. */

function close(handlers: ReturnType<typeof useReturnFocus>) {
    const event = new Event("focusScope.autoFocusOnUnmount", { cancelable: true });
    handlers.onCloseAutoFocus(event);
    return event.defaultPrevented;
}

afterEach(() => {
    document.body.replaceChildren();
});

describe("useReturnFocus", () => {
    it("returns focus to the opener while it's still in the document", () => {
        const fallback = button("fallback");
        const opener = button("opener");
        const { result } = renderHook(() => useReturnFocus({ current: fallback }));

        open(result.current, opener);

        expect(close(result.current)).toBe(true);
        expect(document.activeElement).toBe(opener);
    });

    it("falls back when the opener has unmounted", () => {
        const fallback = button("fallback");
        const opener = button("sheet item");
        const { result } = renderHook(() => useReturnFocus({ current: fallback }));

        open(result.current, opener);
        opener.remove();

        expect(close(result.current)).toBe(true);
        expect(document.activeElement).toBe(fallback);
    });

    it("falls back when nothing was focused on open (opened from a URL)", () => {
        const fallback = button("fallback");
        const { result } = renderHook(() => useReturnFocus({ current: fallback }));

        open(result.current, null);

        expect(close(result.current)).toBe(true);
        expect(document.activeElement).toBe(fallback);
    });

    it("leaves Radix's default alone with no opener and no fallback", () => {
        const { result } = renderHook(() => useReturnFocus());

        open(result.current, null);

        expect(close(result.current)).toBe(false);
    });
});
