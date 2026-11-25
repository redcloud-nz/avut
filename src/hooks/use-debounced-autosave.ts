/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useDebouncer } from "@tanstack/react-pacer";

/**
 * The debounced-save core shared by the draft forms (the I3 forms and the kit check).
 *
 * Pass the save function (normally a mutation's `mutate`, closed over what the save needs) and
 * the mutation's `status` and `reset`. `handleChange(data)` resets a settled mutation, so the
 * save indicator goes back to idle, and queues a save of `data` after `wait` ms without another
 * change. Call `cancel()` before submitting, to drop a pending (not yet sent) save. A save
 * already in flight can still land; the caller's submit has to cope with that.
 */
export function useDebouncedAutosave<TData>({
    save,
    status,
    reset,
    wait = 2000,
}: {
    save: (data: TData) => void;
    status: string;
    reset: () => void;
    wait?: number;
}) {
    const debouncer = useDebouncer(save, { wait });

    function handleChange(data: TData) {
        // Reset the mutation state
        if (status == "success") {
            reset();
        }

        // Trigger the debounced mutation to save the data
        debouncer.maybeExecute(data);
    }

    function cancel() {
        debouncer.cancel();
    }

    return { handleChange, cancel };
}
