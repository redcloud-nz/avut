import { describe, expect, it } from "vitest";

import { scopedRoute } from "./scoped-routes";

const patterns = { organization: "/orgs/[slug]", team: "/teams/[slug]" } as const;

describe("scopedRoute", () => {
    it("builds the organization route", () => {
        expect(scopedRoute({ scope: "organization", slug: "acme" }, patterns, {})).toBe(
            "/orgs/acme",
        );
    });

    it("builds the team route", () => {
        expect(scopedRoute({ scope: "team", slug: "alpha" }, patterns, {})).toBe("/teams/alpha");
    });
});
