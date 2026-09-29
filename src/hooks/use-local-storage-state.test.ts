/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";

import { act, renderHook } from "@testing-library/react";

import { useLocalStorageState } from "./use-local-storage-state";

const KEY = "avut:test:mode";
const schema = z.enum(["quick", "dialog"]);

function useMode() {
    return useLocalStorageState(KEY, schema, "quick");
}

describe("useLocalStorageState", () => {
    afterEach(() => {
        window.localStorage.clear();
    });

    it("returns the default when nothing is stored", () => {
        const { result } = renderHook(useMode);

        expect(result.current[0]).toBe("quick");
    });

    it("stores a set value and reads it back", () => {
        const { result, unmount } = renderHook(useMode);

        act(() => result.current[1]("dialog"));

        expect(result.current[0]).toBe("dialog");
        expect(window.localStorage.getItem(KEY)).toBe("dialog");

        unmount();
        const { result: remounted } = renderHook(useMode);
        expect(remounted.current[0]).toBe("dialog");
    });

    it("falls back to the default when the stored value fails the schema", () => {
        window.localStorage.setItem(KEY, "garbage");

        const { result } = renderHook(useMode);

        expect(result.current[0]).toBe("quick");
    });

    it("keeps two instances on the same key in sync", () => {
        const { result: first } = renderHook(useMode);
        const { result: second } = renderHook(useMode);

        act(() => first.current[1]("dialog"));

        expect(second.current[0]).toBe("dialog");
    });
});
