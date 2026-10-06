#!/usr/bin/env node
/**
 * milestone — the mechanical half of /avut-docs, also used by /avut-ship and /avut-release.
 *
 * Milestones are titled `v<version>`, optionally followed by ` - <codename>` (`v0.11`,
 * `v1 - veronica`). A <version> argument may be given as `0.11`, `v0.11` or the full title.
 * Where it's optional, leaving it out means the lowest open version milestone.
 *
 *   node .claude/skills/avut-docs/milestone.ts show [version]
 *       Prints the milestone, its open issues, and its docs issue (or null), as JSON. With no
 *       milestone for the version (usual for a patch release), prints `"milestone": null`.
 *
 *   node .claude/skills/avut-docs/milestone.ts docs-add <version> <pr> <text>
 *       Adds `- [ ] #<pr> <text>` to the milestone's `Docs: <title>` issue as a marked comment,
 *       creating the issue first if it doesn't exist. Prints the issue number and comment URL.
 *
 *   node .claude/skills/avut-docs/milestone.ts docs-consolidate [version]
 *       Folds the marked item comments into the issue body's `## Items` list. It deletes a
 *       comment only once the re-read body is shown to hold everything the comment said; any
 *       other comment is kept and listed under `skipped`. Prints the checklist.
 *
 *   node .claude/skills/avut-docs/milestone.ts docs-tick <version> <pr> [note]
 *       Ticks #<pr>'s item, appending ` — <note>` if given. Ticking a ticked item does nothing.
 *
 *   node .claude/skills/avut-docs/milestone.ts docs-carry <from-version> <to-version>
 *       Re-adds the old docs issue's unticked items to the new milestone's docs issue, then
 *       closes the old one. For leftovers when a milestone ships without its docs pass.
 *
 *   node .claude/skills/avut-docs/milestone.ts close <version> [--move-to <next-version>]
 *       Closes the milestone. Refuses while it has open issues, unless --move-to is given: then
 *       it moves them to that milestone first (carrying the docs issue's items over with
 *       docs-carry).
 *
 * Issues are listed through the REST API, not `gh issue list`: that goes through the search
 * index, which lags a freshly created issue, so two ships close together could each create a
 * docs issue. Runs under Node's built-in type stripping, so it takes no build step and no
 * dependencies. It talks to GitHub through `gh` and never touches the database.
 */
import { execFileSync } from "node:child_process";

export const REPO = "redcloud-nz/avut";
export const DOCS_LABEL = "documentation";
/** First line of every item comment /avut-ship posts; it's what tells items from discussion. */
export const ITEM_MARKER = "<!-- avut-docs-item -->";
export const ITEMS_HEADING = "## Items";

// ---------------------------------------------------------------------------------------------
// Pure, and covered by milestone.test.ts
// ---------------------------------------------------------------------------------------------

export interface Milestone {
    number: number;
    title: string;
    state: string;
    open_issues: number;
}

/** The version a milestone title or a version argument names: `v1 - veronica` → `1`. */
export function parseVersion(text: string): string | null {
    const match = /^v?(\d+(?:\.\d+)*)(?:\s|$)/i.exec(text.trim());
    return match ? match[1] : null;
}

function compareVersions(a: string, b: string): number {
    const as = a.split(".").map(Number);
    const bs = b.split(".").map(Number);
    for (let i = 0; i < Math.max(as.length, bs.length); i++) {
        const diff = (as[i] ?? 0) - (bs[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/** The milestone for `version`, or with no version the lowest open version milestone. */
export function pickMilestone(milestones: Milestone[], version?: string): Milestone | null {
    const versioned = milestones
        .map((milestone) => ({ milestone, version: parseVersion(milestone.title) }))
        .filter((entry): entry is { milestone: Milestone; version: string } => entry.version !== null);

    if (version !== undefined) {
        const wanted = parseVersion(version);
        if (wanted === null) throw new Error(`"${version}" isn't a version`);
        return versioned.find((entry) => entry.version === wanted)?.milestone ?? null;
    }
    const open = versioned.filter((entry) => entry.milestone.state === "open");
    open.sort((a, b) => compareVersions(a.version, b.version));
    return open[0]?.milestone ?? null;
}

export function docsIssueTitle(milestone: Milestone): string {
    return `Docs: ${milestone.title}`;
}

export function docsIssueBody(milestone: Milestone): string {
    return [
        `End-user docs (\`content/docs/**\` and screenshots) for the changes in ${milestone.title}. Each PR with a user-facing change adds an item as a comment. \`/avut-docs consolidate\` folds them into the list below, and \`/avut-docs\` works through it before the release.`,
        "",
        ITEMS_HEADING,
        "",
        "<!-- Keep this section flat: items, with indented detail lines under them. A heading ends it. -->",
    ].join("\n");
}

const ITEM_LINE = /^- \[( |x)\] #(\d+)\b/i;

/** A checklist item: its `- [ ] #N …` line, plus any indented lines written under it. */
export interface Item {
    pr: number;
    done: boolean;
    line: string;
    detail: string[];
}

function itemFrom(line: string): Item | null {
    const match = ITEM_LINE.exec(line);
    return match ? { pr: Number(match[2]), done: match[1].toLowerCase() === "x", line, detail: [] } : null;
}

function renderItem(item: Item): string[] {
    return [item.line, ...item.detail];
}

export function formatItem(pr: number, text: string): string {
    return `- [ ] #${pr} ${text.replace(/\s+/g, " ").trim()}`;
}

export function itemComment(pr: number, text: string): string {
    return `${ITEM_MARKER}\n${formatItem(pr, text)}`;
}

export function isItemComment(body: string): boolean {
    return body.trimStart().startsWith(ITEM_MARKER);
}

/**
 * Reads lines into items and everything else. An item is a top-level `- [ ] #N` line; the
 * indented lines right after it are its detail. Blank lines end an item's detail.
 */
function readLines(lines: string[]): { items: Item[]; other: string[] } {
    const items: Item[] = [];
    const other: string[] = [];
    let current: Item | null = null;
    for (const raw of lines) {
        const line = raw.replace(/\s+$/, "");
        const item = itemFrom(line);
        if (item) {
            items.push(item);
            current = item;
        } else if (current && /^\s+\S/.test(line)) {
            current.detail.push(line);
        } else {
            current = null;
            if (line.trim() !== "") other.push(line);
        }
    }
    return { items, other };
}

/** The checklist items in a block of markdown. */
export function parseItems(markdown: string): Item[] {
    return readLines(markdown.split("\n")).items;
}

/**
 * The items in a marked comment, and whether that's all the comment says. Only a clean
 * comment may be deleted after a consolidate: anything else in it would be lost.
 */
export function parseItemComment(body: string): { items: Item[]; clean: boolean } {
    const rest = body.trimStart().slice(ITEM_MARKER.length).split("\n");
    const { items, other } = readLines(rest);
    return { items, clean: items.length > 0 && other.length === 0 };
}

/** Splits a body around its `## Items` section, adding an empty one if it has none. */
function splitItemsSection(body: string): { before: string; section: string[]; after: string } {
    const lines = body.replace(/\s+$/, "").split("\n");
    let start = lines.findIndex((line) => line.trim() === ITEMS_HEADING);
    if (start === -1) {
        lines.push("", ITEMS_HEADING);
        start = lines.length - 1;
    }
    let end = lines.findIndex((line, i) => i > start && /^#{1,6} /.test(line));
    if (end === -1) end = lines.length;
    return {
        before: lines.slice(0, start + 1).join("\n"),
        section: lines.slice(start + 1, end),
        after: lines.slice(end).join("\n"),
    };
}

function joinSections(before: string, section: string[], after: string): string {
    const parts = [before, "", ...section];
    if (after) parts.push("", after);
    return `${parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function sectionItems(body: string): Item[] {
    return parseItems(splitItemsSection(body).section.join("\n"));
}

/**
 * Merges `incoming` items into the body's `## Items` section, sorted by PR number, each with
 * its detail lines. An item whose PR is already listed is skipped, so re-running a consolidate
 * never duplicates and never resets a tick. Other lines in the section (notes) stay above the
 * list.
 */
export function mergeItems(body: string, incoming: Item[]): { body: string; added: Item[] } {
    const { before, section, after } = splitItemsSection(body);
    const { items: existing, other: notes } = readLines(section);
    const known = new Set(existing.map((item) => item.pr));
    const added: Item[] = [];
    for (const item of incoming) {
        if (known.has(item.pr)) continue;
        known.add(item.pr);
        added.push(item);
    }
    const items = [...existing, ...added].sort((a, b) => a.pr - b.pr).flatMap(renderItem);
    const merged = joinSections(before, notes.length ? [...notes, "", ...items] : items, after);
    return { body: merged, added };
}

/**
 * Whether `written` holds everything a comment's items said, exactly. A same-PR item with
 * different text is skipped by mergeItems, so it fails this check and its comment survives.
 */
export function bodyHoldsItems(written: string, items: Item[]): boolean {
    const present = sectionItems(written);
    return items.every((item) => present.some((have) => holds(have, item)));
}

/** `have` says everything `item` does: same PR, same text (a tick and its note may follow), same detail. */
function holds(have: Item, item: Item): boolean {
    const text = (i: Item) => i.line.slice(i.line.indexOf("#"));
    return (
        have.pr === item.pr &&
        (text(have) === text(item) || text(have).startsWith(`${text(item)} — `)) &&
        have.detail.join("\n") === item.detail.join("\n")
    );
}

/** Ticks #pr's item in `## Items`, appending ` — note` if given. Already ticked: unchanged. */
export function tickItem(body: string, pr: number, note?: string): string {
    const { before, section, after } = splitItemsSection(body);
    const index = section.findIndex((line) => {
        const item = itemFrom(line.replace(/\s+$/, ""));
        return item !== null && item.pr === pr;
    });
    if (index === -1) throw new Error(`no item for #${pr}; run docs-consolidate first`);
    if (itemFrom(section[index].replace(/\s+$/, ""))?.done) return body;
    let line = section[index].replace(/^- \[ \]/, "- [x]").replace(/\s+$/, "");
    if (note) line = `${line} — ${note.trim()}`;
    const updated = [...section];
    updated[index] = line;
    return joinSections(before, updated, after);
}

/** The text of an item after its `- [ ] #N `, with detail lines folded in, for re-adding. */
export function itemText(item: Item): string {
    return [item.line.replace(ITEM_LINE, "").trim(), ...item.detail.map((line) => line.trim())].join(" ");
}

export function summarise(body: string): { done: number; open: number; items: Item[] } {
    const items = sectionItems(body);
    const done = items.filter((item) => item.done).length;
    return { done, open: items.length - done, items };
}

// ---------------------------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------------------------

function gh(args: string[], input?: string): string {
    return execFileSync("gh", args, {
        encoding: "utf8",
        input,
        stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
}

function ghJson<T>(args: string[]): T {
    return JSON.parse(gh(args)) as T;
}

/** Runs a paginated REST call whose `--jq` emits one compact JSON value per line. */
function ghLines<T>(path: string, jq: string): T[] {
    return gh(["api", "--paginate", path, "--jq", jq])
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as T);
}

function listMilestones(): Milestone[] {
    return ghJson<Milestone[]>(["api", `repos/${REPO}/milestones?state=all&per_page=100`]);
}

function requireMilestone(version?: string): Milestone {
    const milestone = pickMilestone(listMilestones(), version);
    if (!milestone) {
        throw new Error(version ? `no milestone for version ${version}` : "no open version milestone");
    }
    return milestone;
}

interface IssueRef {
    number: number;
    title: string;
    labels: string[];
}

/** Open issues (not PRs) in the milestone, through REST rather than the lagging search index. */
function openIssues(milestone: Milestone): IssueRef[] {
    return ghLines<IssueRef>(
        `repos/${REPO}/issues?milestone=${milestone.number}&state=open&per_page=100`,
        ".[] | select(.pull_request == null) | {number, title, labels: [.labels[].name]}",
    );
}

function findDocsIssue(milestone: Milestone): number | null {
    const title = docsIssueTitle(milestone);
    const issue = openIssues(milestone).find((i) => i.title === title && i.labels.includes(DOCS_LABEL));
    return issue?.number ?? null;
}

function createDocsIssue(milestone: Milestone): number {
    const url = gh(
        [
            "issue", "create", "--repo", REPO, "--title", docsIssueTitle(milestone),
            "--label", DOCS_LABEL, "--milestone", milestone.title, "--body-file", "-",
        ],
        docsIssueBody(milestone),
    ).trim();
    return Number(url.split("/").pop());
}

function readBody(issue: number): string {
    return ghJson<{ body: string }>(["issue", "view", String(issue), "--repo", REPO, "--json", "body"]).body;
}

function writeBody(issue: number, body: string): void {
    gh(["issue", "edit", String(issue), "--repo", REPO, "--body-file", "-"], body);
}

interface Comment {
    id: number;
    body: string;
}

function listComments(issue: number): Comment[] {
    return ghLines<Comment>(`repos/${REPO}/issues/${issue}/comments?per_page=100`, ".[] | {id, body}");
}

function requireDocsIssue(milestone: Milestone): number {
    const issue = findDocsIssue(milestone);
    if (issue === null) throw new Error(`${milestone.title} has no open "${docsIssueTitle(milestone)}" issue`);
    return issue;
}

function checklist(milestone: Milestone, issue: number, body: string, extra: object = {}) {
    const { done, open, items } = summarise(body);
    return { milestone: milestone.title, issue, ...extra, done, open, items: items.map((i) => renderItem(i).join("\n")) };
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

function show(version?: string) {
    const milestone = pickMilestone(listMilestones(), version);
    // A patch release usually has no milestone; that's an answer, not an error.
    if (!milestone) return { milestone: null, openIssues: [], docsIssue: null };
    return {
        milestone: { number: milestone.number, title: milestone.title, state: milestone.state },
        openIssues: openIssues(milestone),
        docsIssue: findDocsIssue(milestone),
    };
}

function addItem(milestone: Milestone, pr: number, text: string) {
    let issue = findDocsIssue(milestone);
    const created = issue === null;
    if (issue === null) issue = createDocsIssue(milestone);
    const url = gh(
        ["issue", "comment", String(issue), "--repo", REPO, "--body-file", "-"],
        itemComment(pr, text),
    ).trim();
    return { milestone: milestone.title, issue, created, comment: url };
}

function docsAdd(version: string, pr: number, text: string) {
    return addItem(requireMilestone(version), pr, text);
}

function consolidate(milestone: Milestone, issue: number) {
    const body = readBody(issue);
    const comments = listComments(issue)
        .filter((comment) => isItemComment(comment.body))
        .map((comment) => ({ ...comment, ...parseItemComment(comment.body) }));
    if (comments.length === 0) return checklist(milestone, issue, body, { folded: 0, skipped: [] });

    const merged = mergeItems(body, comments.flatMap((comment) => comment.items));
    if (merged.added.length) writeBody(issue, merged.body);

    // Delete a comment only when the re-read body provably holds all of it. A lost item is
    // worse than a leftover comment, so anything unproven stays and is reported.
    const written = readBody(issue);
    const folded: number[] = [];
    const skipped: Array<{ id: number; reason: string }> = [];
    for (const comment of comments) {
        if (!comment.clean) {
            skipped.push({ id: comment.id, reason: "comment has text that isn't an item; fold it in by hand" });
        } else if (!bodyHoldsItems(written, comment.items)) {
            skipped.push({ id: comment.id, reason: "its item isn't in the body as written (same PR, different text?)" });
        } else {
            gh(["api", "-X", "DELETE", `repos/${REPO}/issues/comments/${comment.id}`]);
            folded.push(comment.id);
        }
    }
    return checklist(milestone, issue, written, { folded: folded.length, added: merged.added.length, skipped });
}

function docsConsolidate(version?: string) {
    const milestone = requireMilestone(version);
    return consolidate(milestone, requireDocsIssue(milestone));
}

function docsTick(version: string, pr: number, note?: string) {
    const milestone = requireMilestone(version);
    const issue = requireDocsIssue(milestone);
    const before = readBody(issue);
    const body = tickItem(before, pr, note);
    if (body !== before) writeBody(issue, body);
    return checklist(milestone, issue, readBody(issue));
}

function carry(from: Milestone, to: Milestone) {
    const oldIssue = requireDocsIssue(from);
    const { skipped } = consolidate(from, oldIssue);
    if (skipped.length) {
        throw new Error(`#${oldIssue} has item comments consolidate couldn't fold (${skipped.map((s) => s.id).join(", ")}); resolve them first`);
    }
    const leftovers = summarise(readBody(oldIssue)).items.filter((item) => !item.done);
    let newIssue: number | null = findDocsIssue(to);
    for (const item of leftovers) newIssue = addItem(to, item.pr, itemText(item)).issue;
    gh(
        ["issue", "close", String(oldIssue), "--repo", REPO, "--comment", newIssue
            ? `Carried ${leftovers.length} unticked item(s) over to #${newIssue} (${to.title}).`
            : "Nothing left to carry over."],
    );
    return { from: from.title, to: to.title, closed: oldIssue, carried: leftovers.length, issue: newIssue };
}

function docsCarry(fromVersion: string, toVersion: string) {
    return carry(requireMilestone(fromVersion), requireMilestone(toVersion));
}

function close(version: string, moveTo?: string) {
    const milestone = requireMilestone(version);
    const open = openIssues(milestone);
    const moved: number[] = [];
    let carried: object | null = null;
    if (open.length && !moveTo) {
        throw new Error(
            `${milestone.title} still has ${open.length} open issue(s): ${open.map((i) => `#${i.number}`).join(", ")}. Pass --move-to <next-version> to move them first.`,
        );
    }
    if (open.length && moveTo) {
        const target = requireMilestone(moveTo);
        const docsTitle = docsIssueTitle(milestone);
        for (const issue of open) {
            if (issue.title === docsTitle && issue.labels.includes(DOCS_LABEL)) {
                carried = carry(milestone, target);
            } else {
                gh(["issue", "edit", String(issue.number), "--repo", REPO, "--milestone", target.title]);
                moved.push(issue.number);
            }
        }
    }
    gh(["api", "-X", "PATCH", `repos/${REPO}/milestones/${milestone.number}`, "-f", "state=closed"]);
    return { milestone: milestone.title, state: "closed", moved, carried };
}

function prNumber(arg: string | undefined): number {
    const pr = Number(arg?.replace(/^#/, ""));
    if (!Number.isInteger(pr) || pr <= 0) throw new Error(`"${arg}" isn't a PR number`);
    return pr;
}

function usage(): never {
    throw new Error(
        "usage: milestone.ts show [version] | docs-add <version> <pr> <text> | docs-consolidate [version] | docs-tick <version> <pr> [note] | docs-carry <from> <to> | close <version> [--move-to <next>]",
    );
}

if (import.meta.main) {
    const [cmd, ...args] = process.argv.slice(2);
    try {
        let result: object;
        switch (cmd) {
            case "show":
                result = show(args[0]);
                break;
            case "docs-add":
                if (args.length < 3) usage();
                result = docsAdd(args[0], prNumber(args[1]), args.slice(2).join(" "));
                break;
            case "docs-consolidate":
                result = docsConsolidate(args[0]);
                break;
            case "docs-tick":
                if (args.length < 2) usage();
                result = docsTick(args[0], prNumber(args[1]), args.slice(2).join(" ") || undefined);
                break;
            case "docs-carry":
                if (args.length !== 2) usage();
                result = docsCarry(args[0], args[1]);
                break;
            case "close": {
                const flag = args.indexOf("--move-to");
                if (args.length < 1 || flag === 0 || (flag > 0 && !args[flag + 1])) usage();
                result = close(args[0], flag > 0 ? args[flag + 1] : undefined);
                break;
            }
            default:
                usage();
        }
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(`milestone: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
