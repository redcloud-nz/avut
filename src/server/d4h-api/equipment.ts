/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { ForbiddenError } from "@/lib/errors";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import {
    D4HEquipmentItemDetail,
    D4HEquipmentListItem,
    type D4HEquipmentItemUpdate,
} from "@/lib/schemas/d4h/equipment-item";

import { getD4HFetchClient, type D4HListResponse } from "./client";

/**
 * Fetch one equipment item, uncached. Returns `null` when D4H answers 404 (the item was deleted,
 * or never existed), throws `ForbiddenError` on a 403, and throws on any other failure.
 *
 * `location` keeps only the holder's type and id: see `D4HEquipmentItemDetail`.
 */
export async function fetchD4HEquipmentItem(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    itemId: number,
): Promise<D4HEquipmentItemDetail | null> {
    const { data, response } = await getD4HFetchClient(token).GET(
        "/v3/{context}/{contextId}/equipment/{itemId}",
        { params: { path: { context: "team", contextId: d4hTeamId, itemId } } },
    );

    if (response.status === 404) return null;
    if (response.status === 403) {
        throw new ForbiddenError(
            `D4H refused access to equipment item ${itemId} in team ${d4hTeamId}.`,
        );
    }
    // `error` is undefined for a non-ok response with an empty body, so check the response.
    if (!response.ok) {
        throw new Error(
            `Failed to fetch D4H equipment item ${itemId} in team ${d4hTeamId}: ${response.status} ${response.statusText}`,
        );
    }
    return D4HEquipmentItemDetail.schema.parse(data);
}

/**
 * One team's current equipment list, narrowed by `query`, uncached. Throws on any failure, naming
 * `what` in the error.
 *
 * `location` keeps only the holder's type and id: see `D4HEquipmentListItem`.
 */
async function fetchD4HTeamEquipmentList(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    query: { parent_id?: number; kind_id?: number[] },
    what: string,
): Promise<D4HEquipmentListItem[]> {
    const { data, error, response } = await getD4HFetchClient(token).GET(
        "/v3/{context}/{contextId}/equipment",
        {
            params: {
                path: { context: "team", contextId: d4hTeamId },
                query: { ...query, only_current: true, size: 10000 },
            },
        },
    );

    // `error` is undefined for a non-ok response with an empty body, so check the response.
    if (!response.ok) {
        throw new Error(
            `Failed to fetch ${what} in team ${d4hTeamId}: ${response.status} ${response.statusText}`,
            { cause: error },
        );
    }
    return (data as D4HListResponse).results.map((raw) => D4HEquipmentListItem.schema.parse(raw));
}

/** The current items stored directly in one equipment item: see {@link fetchD4HTeamEquipmentList}. */
export function fetchD4HEquipmentItemContents(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    parentId: number,
): Promise<D4HEquipmentListItem[]> {
    return fetchD4HTeamEquipmentList(
        token,
        d4hTeamId,
        { parent_id: parentId },
        `the contents of D4H equipment item ${parentId}`,
    );
}

/** One team's current items of one equipment kind: see {@link fetchD4HTeamEquipmentList}. */
export function fetchD4HEquipmentItemsByKind(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    kindId: number,
): Promise<D4HEquipmentListItem[]> {
    return fetchD4HTeamEquipmentList(
        token,
        d4hTeamId,
        { kind_id: [kindId] },
        `D4H equipment items of kind ${kindId}`,
    );
}

/** Every current item in one team, in a single request: see {@link fetchD4HTeamEquipmentList}. */
export function fetchD4HTeamEquipmentItems(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
): Promise<D4HEquipmentListItem[]> {
    return fetchD4HTeamEquipmentList(token, d4hTeamId, {}, "D4H equipment items");
}

/**
 * The generated PATCH body type omits `notes`, which D4H accepts (live probe, 2026-10-22). This
 * calls the endpoint with an untyped body, isolating the one cast.
 */
function d4hPatchWithUntypedBody(
    fetchClient: ReturnType<typeof getD4HFetchClient>,
    url: string,
    init: { params: { path: Record<string, unknown> }; body: Record<string, unknown> },
) {
    return (
        fetchClient.PATCH as (u: string, init: unknown) => ReturnType<typeof fetchClient.PATCH>
    )(url, init);
}

/**
 * Update one equipment item, uncached. Sends only the keys that are set, since D4H rejects
 * anything outside its PATCHable fields with a 400. Throws with D4H's status and body on failure.
 */
export async function patchD4HEquipmentItem(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    itemId: number,
    update: D4HEquipmentItemUpdate,
): Promise<void> {
    const body = Object.fromEntries(
        Object.entries(update).filter(([, value]) => value !== undefined),
    );

    const { error, response } = await d4hPatchWithUntypedBody(
        getD4HFetchClient(token),
        "/v3/{context}/{contextId}/equipment/{itemId}",
        { params: { path: { context: "team", contextId: d4hTeamId, itemId } }, body },
    );

    if (!response.ok) {
        // openapi-fetch has already read the body into `error` (parsed JSON, or text).
        const detail = error === undefined ? "" : ` ${JSON.stringify(error)}`;
        throw new Error(
            `Failed to update D4H equipment item ${itemId} in team ${d4hTeamId}: ${response.status} ${response.statusText}${detail}`,
            { cause: error },
        );
    }
}
