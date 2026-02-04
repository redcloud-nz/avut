/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import createFetchClient from "openapi-fetch";

import type { paths } from "./schema";

export function getD4hFetchClient() {
    const fetchClient = createFetchClient<paths>({
        baseUrl: "https://api.team-manager.ap.d4h.com",
    });
    fetchClient.use({
        onRequest({ request }) {
            request.headers.set(
                "Authorization",
                `Bearer ${process.env.D4H_API_KEY}`,
            );
            return request;
        },
    });

    return fetchClient;
}
