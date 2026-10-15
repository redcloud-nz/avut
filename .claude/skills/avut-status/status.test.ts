import { describe, expect, it } from "vitest";

import {
    type Branch,
    type Checkout,
    ciState,
    databaseFromEnv,
    parseWorktrees,
    type Report,
    STALE_BEHIND,
    suggest,
} from "./status";

function checkout(overrides: Partial<Checkout> = {}): Checkout {
    return {
        name: "thing",
        path: "/repo/.claude/worktrees/thing",
        isMain: false,
        branch: "feat/thing",
        changes: 0,
        port: 3101,
        serverUp: false,
        database: "avut",
        prunable: false,
        ...overrides,
    };
}

function branch(overrides: Partial<Branch> = {}): Branch {
    return {
        name: "feat/thing",
        ahead: 3,
        behind: 0,
        merged: false,
        onRemote: false,
        unpushed: 3,
        lastCommit: { unix: 0, subject: "feat: thing" },
        worktree: null,
        pr: null,
        ...overrides,
    };
}

function report(overrides: Partial<Report> = {}): Report {
    return {
        fetched: true,
        github: true,
        base: { name: "integration", localBehind: 0 },
        checkouts: [],
        branches: [],
        stashes: [],
        servers: [],
        ...overrides,
    };
}

describe("parseWorktrees", () => {
    it("reads branches, detached heads and prunable entries", () => {
        const porcelain = [
            "worktree /repo\nHEAD aaa\nbranch refs/heads/feat/a",
            "worktree /repo/.claude/worktrees/b\nHEAD bbb\ndetached",
            "worktree /repo/.claude/worktrees/c\nHEAD ccc\nbranch refs/heads/plan/c\nprunable gitdir file points to non-existent location",
        ].join("\n\n");
        expect(parseWorktrees(porcelain + "\n")).toEqual([
            { path: "/repo", branch: "feat/a", detached: false, prunable: false },
            { path: "/repo/.claude/worktrees/b", branch: null, detached: true, prunable: false },
            { path: "/repo/.claude/worktrees/c", branch: "plan/c", detached: false, prunable: true },
        ]);
    });
});

describe("databaseFromEnv", () => {
    it("reads quoted and bare values", () => {
        expect(databaseFromEnv('X=1\nPOSTGRES_DATABASE="avut_thing"\n')).toBe("avut_thing");
        expect(databaseFromEnv("POSTGRES_DATABASE=avut\n")).toBe("avut");
        expect(databaseFromEnv("X=1\n")).toBeNull();
    });
});

describe("ciState", () => {
    it("is fail over pending over pass, and none when empty", () => {
        expect(ciState([])).toBe("none");
        expect(ciState([{ conclusion: "SUCCESS" }, { conclusion: "FAILURE" }])).toBe("fail");
        expect(ciState([{ conclusion: "SUCCESS" }, { status: "IN_PROGRESS", conclusion: "" }])).toBe("pending");
        expect(ciState([{ conclusion: "SUCCESS" }, { state: "SUCCESS" }])).toBe("pass");
    });
});

describe("suggest", () => {
    it("offers to remove a merged, clean worktree without a PR, mentioning its branch DB", () => {
        const c = checkout({ database: "avut_thing" });
        const r = report({ checkouts: [c], branches: [branch({ ahead: 0, merged: true, worktree: c })] });
        expect(suggest(r)).toEqual([
            expect.objectContaining({
                destructive: true,
                command: "npm run worktree:remove thing && git branch -d feat/thing",
                what: expect.stringContaining("avut_thing"),
            }),
        ]);
    });

    it("leaves a merged worktree alone while it has changes", () => {
        const c = checkout({ changes: 2 });
        const r = report({ checkouts: [c], branches: [branch({ ahead: 0, merged: true, worktree: c })] });
        expect(suggest(r)).toEqual([]);
    });

    it("never offers to remove the main checkout", () => {
        const c = checkout({ name: "main", isMain: true, port: 3000 });
        const r = report({ checkouts: [c], branches: [branch({ ahead: 0, merged: true, worktree: c })] });
        expect(suggest(r)).toEqual([]);
    });

    it("offers to delete a merged branch without a worktree, remote too if pushed", () => {
        const r = report({ branches: [branch({ ahead: 0, merged: true, onRemote: true })] });
        expect(suggest(r)[0]).toMatchObject({
            destructive: true,
            command: "git branch -d feat/thing && git push origin --delete feat/thing",
        });
    });

    it("flags a stale branch with a command for its own checkout", () => {
        const c = checkout();
        const r = report({ checkouts: [c], branches: [branch({ behind: STALE_BEHIND + 1, worktree: c })] });
        expect(suggest(r)[0]).toMatchObject({
            destructive: false,
            command: "git -C .claude/worktrees/thing merge origin/integration",
        });
    });

    it("lists waiting plans and failing CI", () => {
        const failing = branch({ pr: { number: 7, url: "", isDraft: false, ci: "fail", review: null, autoMerge: true } });
        const r = report({ branches: [branch({ name: "plan/next" }), failing] });
        const whats = suggest(r).map((s) => s.what);
        expect(whats).toContain("plan waiting: plan/next");
        expect(whats).toContain("#7 (feat/thing) is failing CI");
    });

    it("notices a stale local base and an agent server left on 3100", () => {
        const main = checkout({ name: "main", isMain: true, branch: "chore/x", port: 3100, serverUp: true });
        const r = report({ base: { name: "integration", localBehind: 4 }, checkouts: [main] });
        const s = suggest(r);
        expect(s[0]).toMatchObject({ command: "git branch -f integration origin/integration" });
        expect(s[1].what).toContain("3100");
    });
});
