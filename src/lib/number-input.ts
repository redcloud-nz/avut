/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { ChangeEvent } from "react";

/**
 * `value` and `onChange` for an `<input type="number">` bound to a react-hook-form field.
 *
 * A cleared input sends `NaN`, not `undefined`: these fields' schemas usually carry a
 * `.default(…)`, which would quietly fill an `undefined` back in, where `NaN` fails validation
 * ("Enter a number", from `@/lib/zod-error-map`). `NaN` shows as an empty input. A fraction is
 * passed through as typed, so a `.int()` schema reports it rather than it being truncated.
 */
export function numberInputProps(field: {
    value: number | undefined;
    onChange: (value: number) => void;
}) {
    return {
        value: field.value === undefined || Number.isNaN(field.value) ? "" : field.value,
        onChange: (ev: ChangeEvent<HTMLInputElement>) =>
            field.onChange(ev.currentTarget.valueAsNumber),
    };
}
