#!/usr/bin/env node
/**
 * review-pr — the mechanical half of /avut-review-pr.
 *
 *   node .claude/skills/avut-review-pr/review-pr.ts prep [N]
 *       With N: that PR. Without: every open PR requesting a review from claude-avut.
 *       Decides whether each PR needs a review. For each one that isn't skipped, it
 *       fetches the head to refs/remotes/pr/<N> and collects CI failures and the
 *       earlier review. Prints one JSON document.
 *
 *   node .claude/skills/avut-review-pr/review-pr.ts post <N> <approve|request-changes|comment> <body-file>
 *       Posts the review as claude-avut, with the token scoped to this one call, and
 *       prints the review URL.
 *
 *   node .claude/skills/avut-review-pr/review-pr.ts cleanup
 *       Deletes every refs/remotes/pr/* ref that prep created.
 *
 * Runs under Node's built-in type stripping, so it takes no build step and no dependencies.
 * It never touches the database.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export const REPO = "redcloud-nz/avut";
export const BOT = "claude-avut";

const PR_FIELDS = [
    "number",
    "title",
    "url",
    "author",
    "state",
    "isDraft",
    "headRefName",
    "headRefOid",
    "baseRefName",
    "body",
    "additions",
    "deletions",
    "changedFiles",
    "reviewRequests",
    "reviews",
].join(",");

// ---------------------------------------------------------------------------------------------
// Decision: pure, and covered by review-pr.test.ts
// ---------------------------------------------------------------------------------------------

export interface PrReview {
    author: { login: string } | null;
    state: string;
    body: string;
    submittedAt: string;
    commit: { oid: string } | null;
}

export interface PrInfo {
    number: number;
    title: string;
    url: string;
    author: { login: string } | null;
    state: string;
    isDraft: boolean;
    headRefName: string;
    headRefOid: string;
    baseRefName: string;
    body: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    reviewRequests: Array<{ login?: string; name?: string }>;
    reviews: PrReview[];
}

export type Mode = "specific" | "queue";
export type Action = "review" | "re-review" | "skip" | "unsure";

export interface Decision {
    action: Action;
    reason: string;
    /** The bot's most recent review with a body, if there is one. */
    previous: PrReview | null;
}

/** Most recent review by `bot` that carries a body. Bare thread-reply "reviews" have none. */
export function latestBotReview(pr: PrInfo, bot: string = BOT): PrReview | null {
    const mine = pr.reviews
        .filter((r) => r.author?.login === bot && r.body.trim() !== "")
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    return mine.at(-1) ?? null;
}

export function decide(pr: PrInfo, mode: Mode, bot: string = BOT): Decision {
    const previous = latestBotReview(pr, bot);

    if (pr.state !== "OPEN") return { action: "skip", reason: `#${pr.number} is ${pr.state.toLowerCase()}`, previous };
    if (pr.author?.login === bot) return { action: "skip", reason: `authored by ${bot}, which can't review its own PR`, previous };
    if (pr.isDraft) return { action: "unsure", reason: "draft PR", previous };

    if (!previous) return { action: "review", reason: `no earlier review by ${bot}`, previous };

    const short = (oid: string) => oid.slice(0, 7);
    const reviewedAt = previous.commit?.oid;
    if (reviewedAt !== pr.headRefOid) {
        return {
            action: "re-review",
            reason: `new commits since the last review (${reviewedAt ? short(reviewedAt) : "unknown"} → ${short(pr.headRefOid)})`,
            previous,
        };
    }

    // In queue mode, being in the queue is itself a new request.
    const requested = mode === "queue" || pr.reviewRequests.some((r) => r.login === bot);
    if (requested) return { action: "re-review", reason: "review re-requested at the already-reviewed commit", previous };

    return { action: "skip", reason: `already reviewed at ${short(pr.headRefOid)} with no new request`, previous };
}

// ---------------------------------------------------------------------------------------------
// gh / git plumbing
// ---------------------------------------------------------------------------------------------

function run(cmd: string, args: string[], env?: NodeJS.ProcessEnv): string {
    return execFileSync(cmd, args, { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
}

/** Like run, but returns stdout and the exit status instead of throwing on a non-zero exit. */
function tryRun(cmd: string, args: string[]): { status: number; stdout: string; stderr: string } {
    const r = spawnSync(cmd, args, { encoding: "utf8" });
    return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

interface CheckRow {
    name: string;
    bucket: string;
    link: string;
}

function ciStatus(n: number) {
    // `gh pr checks` exits non-zero when checks fail or are still pending. The JSON is on stdout either way.
    const r = tryRun("gh", ["pr", "checks", String(n), "--repo", REPO, "--json", "name,bucket,link"]);
    let rows: CheckRow[] = [];
    try {
        rows = JSON.parse(r.stdout) as CheckRow[];
    } catch {
        return { failing: [], pending: 0, note: r.stderr.trim() || "no checks reported" };
    }
    const failing = rows
        .filter((c) => c.bucket === "fail")
        .map((c) => {
            const runId = /\/actions\/runs\/(\d+)/.exec(c.link)?.[1];
            const log = runId ? tryRun("gh", ["run", "view", runId, "--repo", REPO, "--log-failed"]).stdout : "";
            return { name: c.name, link: c.link, logTail: log.split("\n").slice(-40).join("\n") };
        });
    return { failing, pending: rows.filter((c) => c.bucket === "pending").length, note: null };
}

function isReachable(oid: string): boolean {
    return tryRun("git", ["cat-file", "-e", `${oid}^{commit}`]).status === 0;
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

function prep(arg: string | undefined) {
    const mode: Mode = arg ? "specific" : "queue";
    let prs: PrInfo[];
    if (arg) {
        const n = /^#?(\d+)$/.exec(arg)?.[1] ?? /\/pull\/(\d+)/.exec(arg)?.[1];
        if (!n) fail(`not a PR number or URL: ${arg}`);
        prs = [JSON.parse(run("gh", ["pr", "view", n, "--repo", REPO, "--json", PR_FIELDS])) as PrInfo];
    } else {
        prs = JSON.parse(
            run("gh", [
                "pr", "list", "--repo", REPO, "--state", "open",
                "--search", `user-review-requested:${BOT}`,
                "--json", PR_FIELDS,
            ]),
        ) as PrInfo[];
    }

    const fetchedBases = new Set<string>();
    const out = prs.map((pr) => {
        const decision = decide(pr, mode);
        const base = {
            number: pr.number,
            title: pr.title,
            url: pr.url,
            author: pr.author?.login ?? null,
            isDraft: pr.isDraft,
            base: pr.baseRefName,
            headRefName: pr.headRefName,
            head: pr.headRefOid,
            size: { additions: pr.additions, deletions: pr.deletions, changedFiles: pr.changedFiles },
            action: decision.action,
            reason: decision.reason,
        };
        if (decision.action === "skip") return base;

        const ref = `pr/${pr.number}`;
        run("git", ["fetch", "--quiet", "--force", "origin", `pull/${pr.number}/head:refs/remotes/${ref}`]);
        if (!fetchedBases.has(pr.baseRefName)) {
            run("git", ["fetch", "--quiet", "origin", pr.baseRefName]);
            fetchedBases.add(pr.baseRefName);
        }

        const prevOid = decision.previous?.commit?.oid ?? null;
        const reachable = prevOid ? isReachable(prevOid) : false;
        return {
            ...base,
            ref,
            diffRange: `origin/${pr.baseRefName}...${ref}`,
            sinceLastReview: decision.action === "re-review" && reachable && prevOid !== pr.headRefOid ? `${prevOid}..${ref}` : null,
            description: pr.body,
            ci: ciStatus(pr.number),
            previous: decision.previous
                ? { state: decision.previous.state, oid: prevOid, reachable, submittedAt: decision.previous.submittedAt, body: decision.previous.body }
                : null,
        };
    });

    process.stdout.write(JSON.stringify({ mode, prs: out }, null, 2) + "\n");
}

const VERDICTS = { approve: "--approve", "request-changes": "--request-changes", comment: "--comment" } as const;

function post(n: string | undefined, verdict: string | undefined, bodyFile: string | undefined) {
    if (!n || !/^\d+$/.test(n) || !verdict || !(verdict in VERDICTS) || !bodyFile) {
        fail("usage: review-pr.ts post <N> <approve|request-changes|comment> <body-file>");
    }
    if (!existsSync(bodyFile)) fail(`no such body file: ${bodyFile}`);

    const token = run("gh", ["auth", "token", "--user", BOT]).trim();
    const env = { ...process.env, GH_TOKEN: token };
    run("gh", ["pr", "review", n, "--repo", REPO, VERDICTS[verdict as keyof typeof VERDICTS], "--body-file", bodyFile], env);

    // --paginate --slurp: every page, as one array of pages. Reviews come oldest first.
    const pages = JSON.parse(
        run("gh", ["api", "--paginate", "--slurp", `repos/${REPO}/pulls/${n}/reviews?per_page=100`], env),
    ) as Array<Array<{ user: { login: string } | null; html_url: string }>>;
    const url = pages.flat().filter((r) => r.user?.login === BOT).at(-1)?.html_url;
    process.stdout.write((url ?? `posted; see https://github.com/${REPO}/pull/${n}`) + "\n");
}

function cleanup() {
    const refs = run("git", ["for-each-ref", "--format=%(refname)", "refs/remotes/pr/"]).split("\n").filter(Boolean);
    for (const ref of refs) run("git", ["update-ref", "-d", ref]);
    process.stdout.write(`removed ${refs.length} pr ref(s)\n`);
}

function fail(message: string): never {
    process.stderr.write(message + "\n");
    process.exit(2);
}

if (import.meta.main) {
    const [cmd, ...args] = process.argv.slice(2);
    if (cmd === "prep") prep(args[0]);
    else if (cmd === "post") post(args[0], args[1], args[2]);
    else if (cmd === "cleanup") cleanup();
    else fail("usage: review-pr.ts prep [N] | post <N> <verdict> <body-file> | cleanup");
}
