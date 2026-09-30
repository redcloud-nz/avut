/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { QueryClient, useQuery } from "@tanstack/react-query";

/**
 * Notes deleted in this session, so their detail pane can say so when Back returns to them.
 *
 * Dropping the note's `getNote` from the cache isn't enough on its own: Back re-renders the
 * note's page from Next's router cache, and that page's `HydrateClient` puts the `getNote` it was
 * first rendered with straight back into the query cache. So the delete also records the id here,
 * and the detail pane checks this before it reads `getNote` at all.
 *
 * Kept in the query cache (a plain key, not a tRPC one) so it's per session and cleared with the
 * rest of the cache on sign-out.
 */
function deletedNotesKey(scopeId: string) {
    return ["notes", "deleted", scopeId] as const;
}

/** Record that a note in the given scope (an organization or user id) has been deleted. */
export function rememberDeletedNote(queryClient: QueryClient, scopeId: string, noteId: string) {
    // Nothing observes the entry while the list is showing, so keep it from being collected.
    queryClient.setQueryDefaults(deletedNotesKey(scopeId), { gcTime: Infinity });
    queryClient.setQueryData<string[]>(deletedNotesKey(scopeId), (ids = []) => [...ids, noteId]);
}

/** Whether the note was deleted in this session. */
export function useIsDeletedNote(scopeId: string, noteId: string): boolean {
    const { data } = useQuery<string[]>({
        queryKey: deletedNotesKey(scopeId),
        // Never fetched: the data only ever comes from `rememberDeletedNote`.
        queryFn: () => [],
        enabled: false,
        staleTime: Infinity,
        gcTime: Infinity,
    });

    return data?.includes(noteId) ?? false;
}
