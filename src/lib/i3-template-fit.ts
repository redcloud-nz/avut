/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Whether an I3 template's D4H records fit a D4H team, and whether they're owned by the AVUT
 * org's linked D4H organisation. Pure and structurally typed, so the server (the Issue form
 * processor and the fit query) and the client (the pickers' flag) share one rule. See
 * `docs/plans/2026-10-25-i3-template-owners.md`, "What fits means".
 */

/** A D4H catalogue record's real owner: one D4H team, or a D4H organisation. */
export type CatalogueRecordOwner = { resourceType: "Team" | "Organisation"; id: number };

/** A D4H catalogue record (category, kind, brand or model), as far as the fit rule reads it. */
export type CatalogueRecord = { id: number; owner: CatalogueRecordOwner };

/** One D4H team's catalogue listing, as `fetchD4HTeamEquipmentCatalogue` returns it. */
export type TeamCatalogue = {
    categories: readonly CatalogueRecord[];
    kinds: readonly CatalogueRecord[];
    brands: readonly CatalogueRecord[];
    models: readonly CatalogueRecord[];
};

/** A D4H team, with the D4H organisation it belongs to, if any. */
export type FitTeam = { id: number; owner?: { id: number } | null };

/** The D4H records a template points at. */
export type TemplateD4HRecords = { categoryId: number; kindId: number };

/** The D4H records a template variant points at. */
export type VariantD4HRecords = { brandId: number; modelId: number };

function findById<T extends { id: number }>(records: readonly T[], id: number): T | undefined {
    return records.find((record) => record.id === id);
}

/** True when a record is owned by a D4H organisation rather than a team. */
export function isOrganisationOwned(owner: CatalogueRecordOwner): boolean {
    return owner.resourceType === "Organisation";
}

/** True only when a record is owned by the D4H organisation with id `d4hOrganisationId`. */
export function isOwnedByOrganisation(
    owner: CatalogueRecordOwner,
    d4hOrganisationId: number,
): boolean {
    return isOrganisationOwned(owner) && owner.id === d4hOrganisationId;
}

/**
 * True when a record fits `team`: it's in the team's own listing and its owner is the team itself
 * or the team's organisation. `undefined` means the record isn't in the team's listing, so it
 * doesn't fit.
 */
export function catalogueRecordFitsTeam(
    record: CatalogueRecord | undefined,
    team: FitTeam,
): boolean {
    if (!record) return false;
    const { owner } = record;
    if (owner.resourceType === "Team") return owner.id === team.id;
    return team.owner != null && owner.id === team.owner.id;
}

/**
 * True when a template's category and kind both fit `team`, looked up in that team's catalogue. A
 * template with no D4H configuration fits no team.
 */
export function templateFitsTeam(
    templateD4H: TemplateD4HRecords | null,
    catalogue: Pick<TeamCatalogue, "categories" | "kinds">,
    team: FitTeam,
): boolean {
    if (!templateD4H) return false;
    return (
        catalogueRecordFitsTeam(findById(catalogue.categories, templateD4H.categoryId), team) &&
        catalogueRecordFitsTeam(findById(catalogue.kinds, templateD4H.kindId), team)
    );
}

/**
 * True when a variant's brand and model both fit `team`, and so does its template. A variant (or
 * template) with no D4H configuration fits no team.
 */
export function variantFitsTeam(
    variantD4H: VariantD4HRecords | null,
    templateD4H: TemplateD4HRecords | null,
    catalogue: TeamCatalogue,
    team: FitTeam,
): boolean {
    if (!variantD4H || !templateFitsTeam(templateD4H, catalogue, team)) return false;
    return (
        catalogueRecordFitsTeam(findById(catalogue.brands, variantD4H.brandId), team) &&
        catalogueRecordFitsTeam(findById(catalogue.models, variantD4H.modelId), team)
    );
}

function anyFoundNotOwnedBy(
    found: (CatalogueRecord | undefined)[],
    d4hOrganisationId: number,
): boolean {
    return found.some(
        (record) => record && !isOwnedByOrganisation(record.owner, d4hOrganisationId),
    );
}

/**
 * True when a template's category or kind is owned by anything other than the D4H organisation
 * `d4hOrganisationId`: a team, or another organisation. A record that isn't found doesn't count.
 */
export function usesOtherRecords(
    templateD4H: TemplateD4HRecords | null,
    catalogue: Pick<TeamCatalogue, "categories" | "kinds">,
    d4hOrganisationId: number,
): boolean {
    if (!templateD4H) return false;
    return anyFoundNotOwnedBy(
        [
            findById(catalogue.categories, templateD4H.categoryId),
            findById(catalogue.kinds, templateD4H.kindId),
        ],
        d4hOrganisationId,
    );
}

/**
 * True when a variant's brand or model is owned by anything other than the D4H organisation
 * `d4hOrganisationId`: a team, or another organisation. A record that isn't found doesn't count.
 */
export function variantUsesOtherRecords(
    variantD4H: VariantD4HRecords | null,
    catalogue: Pick<TeamCatalogue, "brands" | "models">,
    d4hOrganisationId: number,
): boolean {
    if (!variantD4H) return false;
    return anyFoundNotOwnedBy(
        [
            findById(catalogue.brands, variantD4H.brandId),
            findById(catalogue.models, variantD4H.modelId),
        ],
        d4hOrganisationId,
    );
}
