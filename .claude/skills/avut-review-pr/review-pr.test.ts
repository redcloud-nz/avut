import { describe, expect, it } from "vitest";

import { BOT, decide, latestBotReview, type PrInfo, type PrReview } from "./review-pr";

const HEAD = "a".repeat(40);
const OLD = "b".repeat(40);

function review(overrides: Partial<PrReview> = {}): PrReview {
    return {
        author: { login: BOT },
        state: "APPROVED",
        body: "## Review of #1",
        submittedAt: "2026-09-28T10:00:00Z",
        commit: { oid: HEAD },
        ...overrides,
    };
}

function pr(overrides: Partial<PrInfo> = {}): PrInfo {
    return {
        number: 1,
        title: "feat: thing",
        url: "https://github.com/redcloud-nz/avut/pull/1",
        author: { login: "alexwestphal" },
        state: "OPEN",
        isDraft: false,
        headRefName: "feat/thing",
        headRefOid: HEAD,
        baseRefName: "integration",
        body: "",
        additions: 10,
        deletions: 2,
        changedFiles: 1,
        reviewRequests: [],
        reviews: [],
        ...overrides,
    };
}

describe("decide", () => {
    it("skips merged and closed PRs", () => {
        expect(decide(pr({ state: "MERGED" }), "specific").action).toBe("skip");
        expect(decide(pr({ state: "CLOSED" }), "queue").action).toBe("skip");
    });

    it("skips a PR authored by the bot", () => {
        expect(decide(pr({ author: { login: BOT } }), "specific")).toMatchObject({ action: "skip" });
    });

    it("is unsure about drafts", () => {
        expect(decide(pr({ isDraft: true }), "specific").action).toBe("unsure");
    });

    it("reviews a PR with no earlier bot review", () => {
        const other = review({ author: { login: "someone" } });
        expect(decide(pr({ reviews: [other] }), "specific")).toMatchObject({ action: "review", previous: null });
    });

    it("re-reviews when there are commits since the last review", () => {
        const prev = review({ commit: { oid: OLD } });
        expect(decide(pr({ reviews: [prev] }), "specific")).toMatchObject({ action: "re-review", previous: prev });
    });

    it("skips when already reviewed at head and not re-requested", () => {
        expect(decide(pr({ reviews: [review()] }), "specific").action).toBe("skip");
    });

    it("re-reviews at the same commit when re-requested", () => {
        const p = pr({ reviews: [review()], reviewRequests: [{ login: BOT }] });
        expect(decide(p, "specific").action).toBe("re-review");
    });

    it("treats being in the queue as a request", () => {
        expect(decide(pr({ reviews: [review()] }), "queue").action).toBe("re-review");
    });

    it("re-reviews when the last review's commit is unknown", () => {
        expect(decide(pr({ reviews: [review({ commit: null })] }), "specific").action).toBe("re-review");
    });
});

describe("latestBotReview", () => {
    it("picks the most recent bot review with a body, ignoring bare replies and other authors", () => {
        const first = review({ submittedAt: "2026-09-28T10:00:00Z", state: "CHANGES_REQUESTED" });
        const second = review({ submittedAt: "2026-09-28T12:00:00Z" });
        const reply = review({ submittedAt: "2026-09-28T13:00:00Z", state: "COMMENTED", body: "" });
        const human = review({ submittedAt: "2026-09-28T14:00:00Z", author: { login: "alexwestphal" } });
        expect(latestBotReview(pr({ reviews: [second, reply, human, first] }))).toBe(second);
    });
});
