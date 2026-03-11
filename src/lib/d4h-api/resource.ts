/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export interface D4HResource<Type extends string> {
    id: number;
    resourceType: Type;
}
