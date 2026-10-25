/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { ForbiddenError } from "@/lib/errors";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import type { D4HAccessTokenMetadata } from "@/lib/schemas/d4h-provider-metadata";
import { D4HEquipmentBrand } from "@/lib/schemas/d4h/equipment-brand";
import { D4HEquipmentCategory } from "@/lib/schemas/d4h/equipment-category";
import {
    D4HEquipmentItemDetail,
    D4HEquipmentListItem,
    type D4HEquipmentItemUpdate,
} from "@/lib/schemas/d4h/equipment-item";
import { D4HEquipmentKind } from "@/lib/schemas/d4h/equipment-kind";
import { D4HEquipmentModel } from "@/lib/schemas/d4h/equipment-model";

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

/** The parts of a token's metadata that {@link resolveCatalogueOwner} reads. */
export type D4HCatalogueOwnerMetadata = Pick<
    D4HAccessTokenMetadata,
    "d4HTeams" | "d4HOrganisations"
>;

/** A catalogue record's owner as D4H returns it. */
type RawCatalogueOwner = { resourceType: "Team" | "Organisation"; id: number };

/** A catalogue record's owner, with its title resolved. */
export type D4HCatalogueOwner = RawCatalogueOwner & { title: string };

/**
 * Resolve the title of a catalogue record's owner (a category, kind, brand or model), keeping its
 * real `resourceType` and `id`. A `Team` owner's title comes from the token's teams, and an
 * `Organisation` owner's from the token's organisations. An owner out of the token's reach keeps
 * its id and gets a generic title. It never substitutes the team that listed the record.
 */
export function resolveCatalogueOwner(
    rawOwner: RawCatalogueOwner,
    metadata: D4HCatalogueOwnerMetadata,
): D4HCatalogueOwner {
    const { resourceType, id } = rawOwner;
    const title =
        resourceType === "Team"
            ? (metadata.d4HTeams.find((team) => team.id === id)?.title ?? "Another D4H team")
            : (metadata.d4HOrganisations.find((org) => org.id === id)?.title ?? "D4H organisation");
    return { resourceType, id, title };
}

type D4HCatalogueListPath =
    | "/v3/{context}/{contextId}/equipment-brands"
    | "/v3/{context}/{contextId}/equipment-categories"
    | "/v3/{context}/{contextId}/equipment-kinds"
    | "/v3/{context}/{contextId}/equipment-models";

/**
 * One team's catalogue records at `path`, uncached, each parsed with `parse` and its owner
 * resolved with {@link resolveCatalogueOwner}. Throws on any failure, naming `what` in the error.
 */
async function fetchD4HTeamCatalogueList<T extends { owner: RawCatalogueOwner }>(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    metadata: D4HCatalogueOwnerMetadata,
    path: D4HCatalogueListPath,
    parse: (raw: unknown) => T,
    what: string,
): Promise<(Omit<T, "owner"> & { owner: D4HCatalogueOwner })[]> {
    const { data, error, response } = await getD4HFetchClient(token).GET(path, {
        params: { path: { context: "team", contextId: d4hTeamId } },
    });

    // `error` is undefined for a non-ok response with an empty body, so check the response.
    if (!response.ok) {
        throw new Error(`Failed to fetch ${what} for team ${d4hTeamId}`, { cause: error });
    }
    return (data as D4HListResponse).results.map((raw) => {
        const record = parse(raw);
        return { ...record, owner: resolveCatalogueOwner(record.owner, metadata) };
    });
}

/** One team's equipment categories, each with its real owner: see {@link fetchD4HTeamCatalogueList}. */
export function fetchD4HTeamEquipmentCategories(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    metadata: D4HCatalogueOwnerMetadata,
): Promise<D4HEquipmentCategory[]> {
    return fetchD4HTeamCatalogueList(
        token,
        d4hTeamId,
        metadata,
        "/v3/{context}/{contextId}/equipment-categories",
        (raw) => D4HEquipmentCategory.inputSchema.parse(raw),
        "equipment categories",
    );
}

/** One team's equipment kinds, each with its real owner: see {@link fetchD4HTeamCatalogueList}. */
export function fetchD4HTeamEquipmentKinds(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    metadata: D4HCatalogueOwnerMetadata,
): Promise<D4HEquipmentKind[]> {
    return fetchD4HTeamCatalogueList(
        token,
        d4hTeamId,
        metadata,
        "/v3/{context}/{contextId}/equipment-kinds",
        (raw) => D4HEquipmentKind.inputSchema.parse(raw),
        "equipment kinds",
    );
}

/** One team's equipment brands, each with its real owner: see {@link fetchD4HTeamCatalogueList}. */
export function fetchD4HTeamEquipmentBrands(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    metadata: D4HCatalogueOwnerMetadata,
): Promise<D4HEquipmentBrand[]> {
    return fetchD4HTeamCatalogueList(
        token,
        d4hTeamId,
        metadata,
        "/v3/{context}/{contextId}/equipment-brands",
        (raw) => D4HEquipmentBrand.inputSchema.parse(raw),
        "equipment brands",
    );
}

/** One team's equipment models, each with its real owner: see {@link fetchD4HTeamCatalogueList}. */
export function fetchD4HTeamEquipmentModels(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    metadata: D4HCatalogueOwnerMetadata,
): Promise<D4HEquipmentModel[]> {
    return fetchD4HTeamCatalogueList(
        token,
        d4hTeamId,
        metadata,
        "/v3/{context}/{contextId}/equipment-models",
        (raw) => D4HEquipmentModel.inputSchema.parse(raw),
        "equipment models",
    );
}

/** One team's whole equipment catalogue, each record with its real owner, fetched in parallel. */
export async function fetchD4HTeamEquipmentCatalogue(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    metadata: D4HCatalogueOwnerMetadata,
): Promise<{
    categories: D4HEquipmentCategory[];
    kinds: D4HEquipmentKind[];
    brands: D4HEquipmentBrand[];
    models: D4HEquipmentModel[];
}> {
    const [categories, kinds, brands, models] = await Promise.all([
        fetchD4HTeamEquipmentCategories(token, d4hTeamId, metadata),
        fetchD4HTeamEquipmentKinds(token, d4hTeamId, metadata),
        fetchD4HTeamEquipmentBrands(token, d4hTeamId, metadata),
        fetchD4HTeamEquipmentModels(token, d4hTeamId, metadata),
    ]);
    return { categories, kinds, brands, models };
}
