/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The Checks page's search params, shared by `page.tsx` (which prefetches) and `checks-list.tsx`
 * (which reads), so both build the same `skillChecks.searchChecks` input and the prefetch hits.
 * Imported from `nuqs/server` so the server page can use them too.
 */

import {
    createLoader,
    parseAsInteger,
    parseAsString,
    parseAsStringLiteral,
    type inferParserType,
} from "nuqs/server";
import * as z from "zod";

import { Kaga } from "@/components/blocks/kaga";
import type { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SKILL_CHECK_RESULT_VALUES, type CheckSearchFilters } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";

/**
 * Filters replace history, so stepping through filters doesn't flood the back button; changing
 * page pushes. `page` is 1-based and cleared from the URL at its default.
 */
export const checkSearchParsers = {
    person: parseAsString.withOptions({ history: "replace" }),
    assessor: parseAsString.withOptions({ history: "replace" }),
    skill: parseAsString.withOptions({ history: "replace" }),
    /** A session id, or `none` for standalone checks. */
    session: parseAsString.withOptions({ history: "replace" }),
    result: parseAsStringLiteral(SKILL_CHECK_RESULT_VALUES).withOptions({ history: "replace" }),
    /** ISO dates (`YYYY-MM-DD`), both inclusive. */
    from: parseAsString.withOptions({ history: "replace" }),
    to: parseAsString.withOptions({ history: "replace" }),
    page: parseAsInteger.withDefault(1).withOptions({ history: "push" }),
};

export type CheckSearchParams = inferParserType<typeof checkSearchParsers>;

export const loadCheckSearchParams = createLoader(checkSearchParsers);

/** Rows per page of the Checks table. */
export const CHECK_SEARCH_PAGE_SIZE = Kaga.DEFAULT_PAGE_SIZE;

const IsoDate = z.iso.date();

function valid<S extends z.ZodType>(schema: S, value: string | null): z.output<S> | undefined {
    if (value === null) return undefined;
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
}

/**
 * The filters the params describe. A param that fails its schema (a mangled id or date) is
 * dropped, so a hand-edited link shows a valid view rather than an error.
 */
export function checkSearchFilters(params: CheckSearchParams): CheckSearchFilters {
    const filters: CheckSearchFilters = {};

    const assesseeId = valid(PersonId.schema, params.person);
    if (assesseeId) filters.assesseeId = assesseeId;

    const assessorId = valid(PersonId.schema, params.assessor);
    if (assessorId) filters.assessorId = assessorId;

    const skillId = valid(SkillId.schema, params.skill);
    if (skillId) filters.skillId = skillId;

    const sessionId =
        params.session === "none" ? "none" : valid(SkillCheckSessionId.schema, params.session);
    if (sessionId) filters.sessionId = sessionId;

    if (params.result) filters.result = params.result;

    const from = valid(IsoDate, params.from);
    if (from) filters.from = from;

    const to = valid(IsoDate, params.to);
    if (to) filters.to = to;

    return filters;
}

/** The `skillChecks.searchChecks` input for the params. `page` below 1 is clamped to 1. */
export function checkSearchInput(organizationId: OrganizationId, params: CheckSearchParams) {
    return {
        organizationId,
        filters: checkSearchFilters(params),
        page: Math.max(1, params.page),
        pageSize: CHECK_SEARCH_PAGE_SIZE,
    };
}
