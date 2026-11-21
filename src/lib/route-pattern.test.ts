/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { matchesRoutePattern, mostSpecificMatch } from "./route-pattern";

describe("matchesRoutePattern", () => {
    it("matches a static pattern exactly", () => {
        expect(matchesRoutePattern("/user/settings/d4h", "/user/settings/d4h")).toBe(true);
        expect(matchesRoutePattern("/user/settings/d4h", "/user/settings/orgs")).toBe(false);
    });

    it("matches a [param] segment against any one segment", () => {
        expect(matchesRoutePattern("/orgs/[slug]/admin/teams", "/orgs/acme/admin/teams")).toBe(
            true,
        );
        expect(
            matchesRoutePattern(
                "/orgs/[slug]/admin/teams/[team_id]",
                "/orgs/acme/admin/teams/abc123",
            ),
        ).toBe(true);
    });

    it("doesn't match when the segment counts differ", () => {
        expect(
            matchesRoutePattern("/orgs/[slug]/admin/teams", "/orgs/acme/admin/teams/abc123"),
        ).toBe(false);
        expect(
            matchesRoutePattern("/orgs/[slug]/admin/teams/[team_id]", "/orgs/acme/admin/teams"),
        ).toBe(false);
    });

    it("ignores a trailing slash, query string and hash", () => {
        expect(matchesRoutePattern("/orgs/[slug]/admin", "/orgs/acme/admin/")).toBe(true);
        expect(matchesRoutePattern("/orgs/[slug]/admin", "/orgs/acme/admin?help=teams")).toBe(true);
        expect(matchesRoutePattern("/orgs/[slug]/admin", "/orgs/acme/admin/#top")).toBe(true);
    });

    it("matches the root", () => {
        expect(matchesRoutePattern("/", "/")).toBe(true);
        expect(matchesRoutePattern("/", "/orgs")).toBe(false);
    });

    it("throws on catch-all patterns", () => {
        expect(() => matchesRoutePattern("/docs/[...slug]", "/docs/a/b")).toThrow(/Catch-all/);
        expect(() => matchesRoutePattern("/docs/[[...slug]]", "/docs")).toThrow(/Catch-all/);
    });
});

describe("mostSpecificMatch", () => {
    const teams = {
        id: "teams",
        routes: ["/orgs/[slug]/admin/teams", "/orgs/[slug]/admin/teams/[team_id]"],
    };
    const newTeam = { id: "new-team", routes: ["/orgs/[slug]/admin/teams/new"] };
    const personnel = { id: "personnel", routes: ["/orgs/[slug]/admin/personnel"] };
    const cards = [teams, newTeam, personnel];

    it("returns the item listing a matching pattern", () => {
        expect(mostSpecificMatch(cards, "/orgs/acme/admin/personnel")).toBe(personnel);
        expect(mostSpecificMatch(cards, "/orgs/acme/admin/teams/abc123")).toBe(teams);
    });

    it("prefers a static segment over [param], whichever order the items come in", () => {
        expect(mostSpecificMatch(cards, "/orgs/acme/admin/teams/new")).toBe(newTeam);
        expect(mostSpecificMatch([newTeam, teams, personnel], "/orgs/acme/admin/teams/new")).toBe(
            newTeam,
        );
    });

    it("decides at the first differing segment", () => {
        const early = { id: "early", routes: ["/orgs/acme/[section]"] };
        const late = { id: "late", routes: ["/orgs/[slug]/admin"] };
        expect(mostSpecificMatch([late, early], "/orgs/acme/admin")).toBe(early);
    });

    it("returns undefined when nothing matches", () => {
        expect(mostSpecificMatch(cards, "/orgs/acme")).toBeUndefined();
        expect(mostSpecificMatch([], "/orgs/acme/admin/teams")).toBeUndefined();
    });

    it("ignores a trailing slash on the pathname", () => {
        expect(mostSpecificMatch(cards, "/orgs/acme/admin/teams/")).toBe(teams);
    });

    it("throws on catch-all patterns", () => {
        expect(() => mostSpecificMatch([{ routes: ["/docs/[...slug]"] }], "/docs/a")).toThrow(
            /Catch-all/,
        );
    });
});
