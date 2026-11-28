/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Coverage between pages and the help cards' `routes` (`content/help/**`): every page under
 * the authenticated layout is listed by exactly one card or opted out, and resolves to that card.
 */

import { globSync } from "node:fs";
import path from "node:path";
import { allHelpCards } from "content-collections";
import { describe, expect, it } from "vitest";

import { mostSpecificMatch } from "@/lib/route-pattern";

const APP_ROOT = "src/app/(wrapper)/(authenticated)";

/**
 * Pages with no Help card. A new page has to be placed on purpose: listed by a card's
 * `routes`, or added here.
 */
const OPT_OUT_ROUTES = [
    // Dashboards that are a list of modules.
    "/orgs/[slug]",
    "/teams/[slug]",
    "/user",
    // Org admin: D4H access tokens and the scripts index have no card yet.
    "/orgs/[slug]/admin/d4h-access-tokens",
    "/orgs/[slug]/admin/d4h-access-tokens/[token_id]",
    "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/equipment-categories",
    "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/equipment-items",
    "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/equipment-kinds",
    "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/equipment-locations",
    "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/history",
    "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/members",
    "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/organisation",
    "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/whoami",
    "/orgs/[slug]/admin/scripts",
    // I3 pages outside the issue/return/bundles cards.
    "/orgs/[slug]/d4h-i3/inspect",
    "/orgs/[slug]/d4h-i3/issued-types",
    // Self audit campaigns: unlinked and for system admins only.
    "/orgs/[slug]/d4h-i3/self-audit-campaigns",
    "/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]",
    "/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]/differences",
    "/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]/needs",
    "/orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types",
    "/orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types/[type_id]",
    "/orgs/[slug]/d4h-i3/templates",
    "/orgs/[slug]/d4h-i3/templates/[template_id]",
    "/orgs/[slug]/d4h-today",
    // Developer playground.
    "/orgs/[slug]/playground",
    "/orgs/[slug]/playground/bottom-sheet",
    "/orgs/[slug]/playground/person-picker",
    "/orgs/[slug]/playground/select",
    // Skill Package Builder: only its index has a card.
    "/orgs/[slug]/skill-package-builder/packages/[package_id]",
    "/orgs/[slug]/skill-package-builder/packages/[package_id]/contents",
    "/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]",
    "/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/history",
    "/orgs/[slug]/skill-package-builder/packages/[package_id]/history",
    "/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]",
    "/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/history",
    "/orgs/[slug]/skill-track/assessors",
    // System admin and user settings have no cards.
    "/system/admin",
    "/system/admin/groups",
    "/system/admin/groups/[groupId]",
    "/system/admin/organizations",
    "/system/admin/organizations/[organizationId]",
    "/system/admin/organizations/[organizationId]/settings",
    "/system/admin/rubbish-bin",
    "/system/admin/skill-packages",
    "/system/admin/users",
    "/system/admin/users/[user_id]",
    "/user/settings/account",
    "/user/settings/d4h",
    "/user/settings/d4h/access-tokens/[token_id]",
    "/user/settings/organizations",
    "/user/settings/organizations/[organization_id]",
    "/user/settings/preferences",
];

/**
 * The route pattern of every `page.tsx` under the authenticated layout: its folder path with
 * route groups `(…)` and parallel-route slots `@…` dropped.
 */
const SCRATCH_ROOT = "/orgs/[slug]/system/scratch/";

function pageRoutes(): string[] {
    return (
        globSync(`${APP_ROOT}/**/page.tsx`)
            .map((file) => {
                const segments = path
                    .relative(APP_ROOT, path.dirname(file))
                    .split(path.sep)
                    .filter((s) => s !== "" && !/^\(.*\)$/.test(s) && !s.startsWith("@"));
                return "/" + segments.join("/");
            })
            // Scratch pages are throwaway visual tests, committed freely (see the scratch README),
            // so they're never Help pages and don't each need an opt-out entry.
            .filter((route) => !route.startsWith(SCRATCH_ROOT))
            .sort()
    );
}

describe("help card routes", () => {
    const pages = pageRoutes();
    const pageSet = new Set(pages);
    const optOut = new Set(OPT_OUT_ROUTES);

    /** Every card listing each pattern. */
    const listedBy = new Map<string, string[]>();
    for (const card of allHelpCards) {
        for (const pattern of card.routes) {
            listedBy.set(pattern, [...(listedBy.get(pattern) ?? []), card.id]);
        }
    }

    it("finds the pages", () => {
        expect(pages.length).toBeGreaterThan(0);
    });

    it("places every page on exactly one card, or opts it out", () => {
        for (const page of pages) {
            const cards = listedBy.get(page) ?? [];
            if (optOut.has(page)) continue;
            expect(
                cards.length,
                `${page}: listed by no help card's routes; add it to one or to OPT_OUT_ROUTES`,
            ).toBe(1);
        }
    });

    it("lists only real pages on cards", () => {
        for (const [pattern, cards] of listedBy) {
            expect(pageSet.has(pattern), `${cards.join(", ")}: "${pattern}" is not a page`).toBe(
                true,
            );
        }
    });

    it("lists no pattern on two cards", () => {
        for (const [pattern, cards] of listedBy) {
            expect(cards, `"${pattern}" is listed by more than one card`).toHaveLength(1);
        }
    });

    it("opts out only uncovered pages", () => {
        for (const route of OPT_OUT_ROUTES) {
            expect(pageSet.has(route), `OPT_OUT_ROUTES: "${route}" is not a page`).toBe(true);
            expect(
                listedBy.get(route),
                `OPT_OUT_ROUTES: "${route}" is listed by a card`,
            ).toBeUndefined();
        }
    });

    it("resolves every page to the card that lists it", () => {
        for (const page of pages) {
            const expected = listedBy.get(page)?.[0];
            expect(mostSpecificMatch(allHelpCards, page)?.id, page).toBe(expected);
        }
    });
});
