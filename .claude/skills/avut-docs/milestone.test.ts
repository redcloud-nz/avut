import { describe, expect, it } from "vitest";

import {
    bodyHoldsItems,
    carriedItemComment,
    docsIssueBody,
    isItemComment,
    itemComment,
    sectionNotes,
    type Milestone,
    mergeItems,
    parseItemComment,
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

const lines = (body: string) => summarise(body).items.map((item) => [item.line, ...item.detail].join("\n"));

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
        expect(parseItemComment(body)).toEqual({
            clean: true,
            items: [{ pr: 312, done: false, line: "- [ ] #312 Notes can be pinned. Pages: notes/index.mdx", detail: [] }],
        });
    });

    it("doesn't mistake discussion for an item", () => {
        expect(isItemComment("Should #312 also cover the help sheet?")).toBe(false);
    });

    it("keeps indented lines as the item's detail", () => {
        const { items, clean } = parseItemComment("<!-- avut-docs-item -->\n- [ ] #4 x\n  - also the help sheet");
        expect(clean).toBe(true);
        expect(items[0].detail).toEqual(["  - also the help sheet"]);
    });

    it("isn't clean when it says more than its items", () => {
        expect(parseItemComment("<!-- avut-docs-item -->\n- [ ] #4 x\nAnd a thought.").clean).toBe(false);
        expect(parseItemComment("<!-- avut-docs-item -->\nedited away").clean).toBe(false);
    });
});

describe("mergeItems", () => {
    const body = docsIssueBody(milestone("v0.11"));

    it("adds items to an empty section, sorted by PR", () => {
        const result = mergeItems(body, parseItems("- [ ] #320 b\n- [ ] #310 a"));
        expect(result.added.map((item) => item.pr)).toEqual([320, 310]);
        expect(result.body.endsWith("\n\n- [ ] #310 a\n- [ ] #320 b\n")).toBe(true);
        expect(lines(result.body)).toEqual(["- [ ] #310 a", "- [ ] #320 b"]);
    });

    it("skips PRs already listed and keeps their ticks", () => {
        const first = mergeItems(body, parseItems("- [ ] #310 a\n- [ ] #320 b")).body;
        const ticked = tickItem(first, 310, "done");
        const second = mergeItems(ticked, parseItems("- [ ] #310 a again\n- [ ] #315 c"));
        expect(second.added.map((item) => item.pr)).toEqual([315]);
        expect(lines(second.body)).toEqual(["- [x] #310 a — done", "- [ ] #315 c", "- [ ] #320 b"]);
    });

    it("carries each item's detail lines with it when sorting", () => {
        const first = mergeItems(body, parseItems("- [ ] #9 late\n  - detail of 9")).body;
        const second = mergeItems(first, parseItems("- [ ] #2 early"));
        expect(lines(second.body)).toEqual(["- [ ] #2 early", "- [ ] #9 late\n  - detail of 9"]);
    });

    it("adds an Items section to a body without one", () => {
        const result = mergeItems("Some intro.", parseItems("- [ ] #1 x"));
        expect(result.body).toBe("Some intro.\n\n## Items\n\n- [ ] #1 x\n");
    });

    it("keeps notes in the section, and stops at any heading", () => {
        const custom = "Intro\n\n## Items\n\nScreenshots wait for the new theme.\n- [ ] #5 e\n\n### Deferred\n\n- [ ] #2 later\n";
        const result = mergeItems(custom, parseItems("- [ ] #3 c"));
        expect(result.body).toBe(
            "Intro\n\n## Items\n\nScreenshots wait for the new theme.\n\n- [ ] #3 c\n- [ ] #5 e\n\n### Deferred\n\n- [ ] #2 later\n",
        );
    });
});

describe("bodyHoldsItems", () => {
    const base = mergeItems(docsIssueBody(milestone("v0.11")), parseItems("- [ ] #7 seven\n  - detail")).body;

    it("holds an item it just merged, detail included", () => {
        expect(bodyHoldsItems(base, parseItems("- [ ] #7 seven\n  - detail"))).toBe(true);
    });

    it("still holds it once ticked with a note", () => {
        expect(bodyHoldsItems(tickItem(base, 7, "done"), parseItems("- [ ] #7 seven\n  - detail"))).toBe(true);
    });

    it("doesn't hold a same-PR item with different text or detail", () => {
        expect(bodyHoldsItems(base, parseItems("- [ ] #7 seven, corrected\n  - detail"))).toBe(false);
        expect(bodyHoldsItems(base, parseItems("- [ ] #7 seven\n  - other detail"))).toBe(false);
        expect(bodyHoldsItems(base, parseItems("- [ ] #8 eight"))).toBe(false);
    });
});

describe("tickItem", () => {
    it("throws for a PR with no item", () => {
        expect(() => tickItem("## Items\n\n- [ ] #1 x\n", 2)).toThrow(/no item for #2/);
    });

    it("only ticks inside the Items section", () => {
        const body = "Intro mentions\n- [ ] #1 elsewhere\n\n## Items\n\n- [ ] #1 x\n";
        const ticked = tickItem(body, 1);
        expect(ticked).toContain("- [ ] #1 elsewhere");
        expect(lines(ticked)).toEqual(["- [x] #1 x"]);
    });

    it("leaves an already-ticked item alone", () => {
        const once = tickItem("## Items\n\n- [ ] #1 x\n", 1, "done");
        expect(tickItem(once, 1, "done")).toBe(once);
        expect(tickItem(once, 1)).toBe(once);
    });

    it("adds a new note to an already-ticked item", () => {
        const once = tickItem("## Items\n\n- [ ] #1 x\n", 1);
        expect(lines(tickItem(once, 1, "no change needed"))).toEqual(["- [x] #1 x — no change needed"]);
    });
});

describe("carriedItemComment", () => {
    it("re-adds an item unticked, with its detail lines intact", () => {
        const [item] = parseItems("- [x] #4 Pinned notes. Pages: notes/index.mdx\n  - and the help sheet");
        const comment = carriedItemComment(item);
        expect(comment).toBe("<!-- avut-docs-item -->\n- [ ] #4 Pinned notes. Pages: notes/index.mdx\n  - and the help sheet");
        expect(parseItemComment(comment)).toEqual({ clean: true, items: [{ ...item, done: false, line: "- [ ] #4 Pinned notes. Pages: notes/index.mdx" }] });
    });
});

describe("sectionNotes", () => {
    it("returns the section's non-item lines", () => {
        expect(sectionNotes("## Items\n\nWait for the theme.\n- [ ] #1 x\n  - detail\n")).toEqual(["Wait for the theme."]);
    });
});
