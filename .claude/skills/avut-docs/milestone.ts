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
 *       Folds the marked item comments into the issue body's `## Items` list, confirms the body
 *       took, then deletes exactly those comments. Prints the checklist.
 *
 *   node .claude/skills/avut-docs/milestone.ts docs-tick <version> <pr> [note]
 *       Ticks #<pr>'s item in the body, appending ` — <note>` if given. Prints the checklist.
 *
 *   node .claude/skills/avut-docs/milestone.ts close <version>
 *       Closes the milestone. Refuses while it has open issues.
 *
 * Runs under Node's built-in type stripping, so it takes no build step and no dependencies.
 * It talks to GitHub through `gh` and never touches the database.
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
    ].join("\n");
}

const ITEM_LINE = /^- \[( |x)\] #(\d+)\b/i;

export interface Item {
    pr: number;
    done: boolean;
    line: string;
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

/** The checklist lines in a block of markdown. */
export function parseItems(markdown: string): Item[] {
    return markdown.split("\n").flatMap((raw) => {
        const line = raw.trim();
        const match = ITEM_LINE.exec(line);
        return match ? [{ pr: Number(match[2]), done: match[1].toLowerCase() === "x", line }] : [];
    });
}

/** Splits a body around its `## Items` section, adding an empty one if it has none. */
function splitItemsSection(body: string): { before: string; section: string[]; after: string } {
    const lines = body.replace(/\s+$/, "").split("\n");
    let start = lines.findIndex((line) => line.trim() === ITEMS_HEADING);
    if (start === -1) {
        lines.push("", ITEMS_HEADING);
        start = lines.length - 1;
    }
    let end = lines.findIndex((line, i) => i > start && /^#{1,2} /.test(line));
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

/**
 * Merges `incoming` items into the body's `## Items` section, sorted by PR number. An item
 * whose PR is already listed is skipped, so re-running a consolidate never duplicates and
 * never resets a tick. Other lines in the section (notes) stay above the list.
 */
export function mergeItems(body: string, incoming: Item[]): { body: string; added: Item[] } {
    const { before, section, after } = splitItemsSection(body);
    const existing = parseItems(section.join("\n"));
    const known = new Set(existing.map((item) => item.pr));
    const added: Item[] = [];
    for (const item of incoming) {
        if (known.has(item.pr)) continue;
        known.add(item.pr);
        added.push(item);
    }
    const notes = section.filter((line) => line.trim() !== "" && !ITEM_LINE.test(line.trim()));
    const items = [...existing, ...added].sort((a, b) => a.pr - b.pr).map((item) => item.line);
    const body2 = joinSections(before, notes.length ? [...notes, "", ...items] : items, after);
    return { body: body2, added };
}

/** Ticks #pr's item, appending ` — note` if given. Throws if the body has no item for it. */
export function tickItem(body: string, pr: number, note?: string): string {
    const lines = body.split("\n");
    const index = lines.findIndex((line) => {
        const match = ITEM_LINE.exec(line.trim());
        return match !== null && Number(match[2]) === pr;
    });
    if (index === -1) throw new Error(`no item for #${pr}; run docs-consolidate first`);
    let line = lines[index].replace(/^(\s*)- \[ \]/, "$1- [x]");
    if (note) line = `${line} — ${note.trim()}`;
    lines[index] = line;
    return lines.join("\n");
}

export function summarise(body: string): { done: number; open: number; items: Item[] } {
    const items = parseItems(splitItemsSection(body).section.join("\n"));
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
    labels?: Array<{ name: string }>;
}

function openIssues(milestone: Milestone): IssueRef[] {
    return ghJson<IssueRef[]>([
        "issue", "list", "--repo", REPO, "--milestone", milestone.title,
        "--state", "open", "--limit", "200", "--json", "number,title,labels",
    ]);
}

/** The open docs issue, matched by exact title. No `--search`: the search index lags a fresh issue. */
function findDocsIssue(milestone: Milestone): number | null {
    const title = docsIssueTitle(milestone);
    const issues = ghJson<IssueRef[]>([
        "issue", "list", "--repo", REPO, "--milestone", milestone.title, "--label", DOCS_LABEL,
        "--state", "open", "--limit", "200", "--json", "number,title",
    ]);
    return issues.find((issue) => issue.title === title)?.number ?? null;
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
    const out = gh(["api", "--paginate", `repos/${REPO}/issues/${issue}/comments`, "--jq", ".[] | {id, body}"]);
    return out.split("\n").filter(Boolean).map((line) => JSON.parse(line) as Comment);
}

function requireDocsIssue(milestone: Milestone): number {
    const issue = findDocsIssue(milestone);
    if (issue === null) throw new Error(`${milestone.title} has no open "${docsIssueTitle(milestone)}" issue`);
    return issue;
}

function checklist(milestone: Milestone, issue: number, body: string, extra: object = {}) {
    const { done, open, items } = summarise(body);
    return { milestone: milestone.title, issue, ...extra, done, open, items: items.map((item) => item.line) };
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
        openIssues: openIssues(milestone).map((issue) => ({
            number: issue.number,
            title: issue.title,
            labels: (issue.labels ?? []).map((label) => label.name),
        })),
        docsIssue: findDocsIssue(milestone),
    };
}

function docsAdd(version: string, pr: number, text: string) {
    const milestone = requireMilestone(version);
    let issue = findDocsIssue(milestone);
    const created = issue === null;
    if (issue === null) issue = createDocsIssue(milestone);
    const url = gh(
        ["issue", "comment", String(issue), "--repo", REPO, "--body-file", "-"],
        itemComment(pr, text),
    ).trim();
    return { milestone: milestone.title, issue, created, comment: url };
}

function docsConsolidate(version?: string) {
    const milestone = requireMilestone(version);
    const issue = requireDocsIssue(milestone);
    const body = readBody(issue);
    const comments = listComments(issue).filter((comment) => isItemComment(comment.body));
    if (comments.length === 0) return checklist(milestone, issue, body, { folded: 0 });

    const incoming = comments.flatMap((comment) => parseItems(comment.body));
    const merged = mergeItems(body, incoming);
    writeBody(issue, merged.body);

    // Delete nothing unless the write took: a lost item is worse than a duplicate comment.
    const written = readBody(issue);
    const present = new Set(parseItems(written).map((item) => item.pr));
    const missing = incoming.filter((item) => !present.has(item.pr)).map((item) => `#${item.pr}`);
    if (missing.length) throw new Error(`body write didn't take (missing ${missing.join(", ")}); no comments deleted`);

    for (const comment of comments) {
        gh(["api", "-X", "DELETE", `repos/${REPO}/issues/comments/${comment.id}`]);
    }
    return checklist(milestone, issue, written, { folded: comments.length, added: merged.added.length });
}

function docsTick(version: string, pr: number, note?: string) {
    const milestone = requireMilestone(version);
    const issue = requireDocsIssue(milestone);
    const body = tickItem(readBody(issue), pr, note);
    writeBody(issue, body);
    return checklist(milestone, issue, readBody(issue));
}

function close(version: string) {
    const milestone = requireMilestone(version);
    const open = openIssues(milestone);
    if (open.length) {
        throw new Error(`${milestone.title} still has ${open.length} open issue(s): ${open.map((i) => `#${i.number}`).join(", ")}`);
    }
    gh(["api", "-X", "PATCH", `repos/${REPO}/milestones/${milestone.number}`, "-f", "state=closed"]);
    return { milestone: milestone.title, state: "closed" };
}

function prNumber(arg: string | undefined): number {
    const pr = Number(arg?.replace(/^#/, ""));
    if (!Number.isInteger(pr) || pr <= 0) throw new Error(`"${arg}" isn't a PR number`);
    return pr;
}

function usage(): never {
    throw new Error(
        "usage: milestone.ts show [version] | docs-add <version> <pr> <text> | docs-consolidate [version] | docs-tick <version> <pr> [note] | close <version>",
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
            case "close":
                if (args.length < 1) usage();
                result = close(args[0]);
                break;
            default:
                usage();
        }
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(`milestone: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
