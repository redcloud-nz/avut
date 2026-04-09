/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Route } from "next";
import { AppRoutes, ParamMap } from "../../.next/types/routes";

export function route<AppRoute extends AppRoutes>(
    route: AppRoute,
    params: ParamMap[AppRoute],
): Route {
    let path = route as string;

    for (const [key, value] of Object.entries(params)) {
        path = path.replace(`[${key}]`, value);
    }

    return path as Route;
}
