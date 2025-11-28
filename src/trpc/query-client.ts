/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    defaultShouldDehydrateQuery,
    QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000 * 10,
            },
            dehydrate: {
                serializeData: superjson.serialize,
                shouldDehydrateQuery: (query) =>
                    defaultShouldDehydrateQuery(query) &&
                    query.state.status === "pending",
            },
            hydrate: {
                deserializeData: superjson.deserialize,
            },
        },
    });
}
