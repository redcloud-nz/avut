/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useCallback, useSyncExternalStore } from "react";
import * as z from "zod";

/** Dispatched on `window` after a set in this tab (`detail` is the key); `storage` only fires in others. */
const LOCAL_STORAGE_SET_EVENT = "avut:local-storage-set";

/** Where values go when `localStorage` throws (e.g. blocked site data), so a set still sticks for this page load. */
const fallbackStore = new Map<string, string>();

function readItem(key: string): string | null {
    // A fallback value is newer than anything in `localStorage`: it's only written when a
    // `setItem` threw, and cleared by the next one that succeeds.
    const fallback = fallbackStore.get(key);
    if (fallback !== undefined) return fallback;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeItem(key: string, value: string) {
    try {
        window.localStorage.setItem(key, value);
        fallbackStore.delete(key);
    } catch {
        fallbackStore.set(key, value);
    }
}

/**
 * A string value remembered per browser in `localStorage` under `key`, kept in sync across every
 * component (and tab) using the same key.
 *
 * Restricted to strings so the snapshot is the stored string itself, which is stable between
 * renders without caching a parse. The server snapshot is `defaultValue`, so it renders the
 * default on the server and during hydration, then the stored value. A missing value, or one that
 * fails `schema`, reads as `defaultValue`.
 */
export function useLocalStorageState<T extends string>(
    key: string,
    schema: z.ZodType<T>,
    defaultValue: T,
): [T, (value: T) => void] {
    const subscribe = useCallback(
        (onChange: () => void) => {
            function handleStorage(event: StorageEvent) {
                // A null key means the whole storage was cleared.
                if (event.key === null || event.key === key) onChange();
            }
            function handleLocalSet(event: Event) {
                if ((event as CustomEvent<string>).detail === key) onChange();
            }

            window.addEventListener("storage", handleStorage);
            window.addEventListener(LOCAL_STORAGE_SET_EVENT, handleLocalSet);
            return () => {
                window.removeEventListener("storage", handleStorage);
                window.removeEventListener(LOCAL_STORAGE_SET_EVENT, handleLocalSet);
            };
        },
        [key],
    );

    const stored = useSyncExternalStore(
        subscribe,
        () => readItem(key),
        () => null,
    );

    const parsed = schema.safeParse(stored);
    const value = parsed.success ? parsed.data : defaultValue;

    const setValue = useCallback(
        (next: T) => {
            writeItem(key, next);
            window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_SET_EVENT, { detail: key }));
        },
        [key],
    );

    return [value, setValue];
}
