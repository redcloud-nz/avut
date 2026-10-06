import { describe, expect, it } from "vitest";

import {
    docsIssueBody,
    formatItem,
    isItemComment,
    itemComment,
    type Milestone,
    mergeItems,
    parseItems,
    parseVersion,
    pickMilestone,
    summarise,
    tickItem,
} from "./milestone";

function milestone(title: string, state = "open", number = 1): Milestone {
    return { number, title, state, open_issues: 0 };
}

const MILESTONES = [
    milestone("v0.9", "closed", 1),
    milestone("v2 - chatham", "open", 2),
    milestone("v1 - veronica", "open", 3),
    milestone("v0.10", "closed", 4),
    milestone("v0.11", "open", 5),
    milestone("v0.12", "open", 6),
    milestone("Someday", "open", 7),
];

describe("parseVersion", () => {
    it("reads a title, with or without a codename", () => {
        expect(parseVersion("v0.11")).toBe("0.11");
        expect(parseVersion("v1 - veronica")).toBe("1");
        expect(parseVersion("V0.9")).toBe("0.9");
    });

    it("reads a bare version argument", () => {
        expect(parseVersion("0.11")).toBe("0.11");
        expect(parseVersion("1")).toBe("1");
    });

    it("rejects titles that aren't versions", () => {
        expect(parseVersion("Someday")).toBeNull();
        expect(parseVersion("v0.11beta")).toBeNull();
    });
});

describe("pickMilestone", () => {
    it("finds a version exactly, not by prefix", () => {
        expect(pickMilestone(MILESTONES, "0.11")?.number).toBe(5);
        expect(pickMilestone(MILESTONES, "v0.11")?.number).toBe(5);
        expect(pickMilestone(MILESTONES, "0.1")).toBeNull();
        expect(pickMilestone(MILESTONES, "1")?.number).toBe(3);
        expect(pickMilestone(MILESTONES, "v1 - veronica")?.number).toBe(3);
    });

    it("returns null for a patch release with no milestone", () => {
        expect(pickMilestone(MILESTONES, "0.9.3")).toBeNull();
    });

    it("defaults to the lowest open version, comparing numerically", () => {
        expect(pickMilestone(MILESTONES)?.title).toBe("v0.11");
        expect(pickMilestone([milestone("v0.9"), milestone("v0.10")])?.title).toBe("v0.9");
    });

    it("throws on an argument that isn't a version", () => {
        expect(() => pickMilestone(MILESTONES, "latest")).toThrow();
    });
});

describe("item comments", () => {
    it("round-trips through the marker", () => {
        const body = itemComment(312, "Notes can be pinned.\n Pages: notes/index.mdx");
        expect(isItemComment(body)).toBe(true);
        expect(parseItems(body)).toEqual([
            { pr: 312, done: false, line: "- [ ] #312 Notes can be pinned. Pages: notes/index.mdx" },
        ]);
    });

    it("doesn't mistake discussion for an item", () => {
        expect(isItemComment("Should #312 also cover the help sheet?")).toBe(false);
    });
});

describe("mergeItems", () => {
    const body = docsIssueBody(milestone("v0.11"));

    it("adds items to an empty section, sorted by PR", () => {
        const result = mergeItems(body, [parseItems(formatItem(320, "b"))[0], parseItems(formatItem(310, "a"))[0]]);
        expect(result.added.map((item) => item.pr)).toEqual([320, 310]);
        expect(result.body.endsWith("## Items\n\n- [ ] #310 a\n- [ ] #320 b\n")).toBe(true);
    });

    it("skips PRs already listed and keeps their ticks", () => {
        const first = mergeItems(body, parseItems("- [ ] #310 a\n- [ ] #320 b")).body;
        const ticked = tickItem(first, 310, "done");
        const second = mergeItems(ticked, parseItems("- [ ] #310 a again\n- [ ] #315 c"));
        expect(second.added.map((item) => item.pr)).toEqual([315]);
        expect(summarise(second.body).items.map((item) => item.line)).toEqual([
            "- [x] #310 a — done",
            "- [ ] #315 c",
            "- [ ] #320 b",
        ]);
    });

    it("adds an Items section to a body without one", () => {
        const result = mergeItems("Some intro.", parseItems("- [ ] #1 x"));
        expect(result.body).toBe("Some intro.\n\n## Items\n\n- [ ] #1 x\n");
    });

    it("keeps notes in the section and sections after it", () => {
        const custom = "Intro\n\n## Items\n\nScreenshots wait for the new theme.\n- [ ] #5 e\n\n## Deferred\n\n- #2 later\n";
        const result = mergeItems(custom, parseItems("- [ ] #3 c"));
        expect(result.body).toBe(
            "Intro\n\n## Items\n\nScreenshots wait for the new theme.\n\n- [ ] #3 c\n- [ ] #5 e\n\n## Deferred\n\n- #2 later\n",
        );
    });
});

describe("tickItem", () => {
    it("throws for a PR with no item", () => {
        expect(() => tickItem("## Items\n\n- [ ] #1 x\n", 2)).toThrow(/no item for #2/);
    });
});
