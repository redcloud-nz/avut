/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export const subappIds = ["i3", "orgs"] as const;

export type SubappId = (typeof subappIds)[number];
