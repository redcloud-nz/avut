/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export const Subapps = {
    i3: { name: "AVUT - I3" },
    main: { name: "AVUT - Main" },
} as const;

export type SubappId = keyof typeof Subapps;
