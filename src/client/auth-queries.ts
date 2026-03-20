/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { authClient } from "@/client/auth-client";

export const authQueries = {
    session: {
        queryKey: ["auth", "session"] as const,

        queryFn: () => authClient.getSession({ fetchOptions: { throw: true } }),
    },
};
