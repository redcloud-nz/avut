/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ContrastTextColorConfig, getContrastTextColor } from "@/lib/color";

export function ColorValue({
    value,
    config = {},
}: {
    value: string;
    config?: Partial<ContrastTextColorConfig>;
}) {
    if (!value) return null;
    if (!value.startsWith("#"))
        throw new Error(`ColorValue: value must start with '#'`);

    const contrastColor = getContrastTextColor(value, config);

    return (
        <span
            className="inline-flex gap-0.5 px-2 py-1 -my-1 rounded-sm font-mono"
            style={{
                backgroundColor: value,
                color: contrastColor,
                textShadow: `.2px .2px .2px #6b7280`,
            }}
        >
            <span className="font-semibold mr-.5">#</span>
            <span>{value.substring(1, 3)}</span>
            <span>{value.substring(3, 5)}</span>
            <span>{value.substring(5, 7)}</span>
        </span>
    );
}
