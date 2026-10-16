#!/usr/bin/env node
/**
 * status — the mechanical half of /avut-status: where every branch, worktree, PR, stash and dev
 * server stands, in one pass.
 *
 *   node .claude/skills/avut-status/status.ts [--json] [--offline] [--no-fetch]
 *       --json      print the raw report instead of markdown
 *       --offline   skip GitHub (no PR column) and the fetch
 *       --no-fetch  skip `git fetch --prune origin` (the numbers are then as of the last fetch)
 *
 * Read-only apart from the fetch: it never changes a branch, a worktree or the database. Runs
 * under Node's built-in type stripping, so it takes no build step and no dependencies.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export const REPO = "redcloud-nz/avut";
export const BASE = "integration";

/** Branches that are never feature work, so they're left out of the branch lists. */
const LONG_LIVED = new Set([BASE, "production"]);

/** Behind the base by more than this, a branch gets a "merge integration" suggestion. */
export const STALE_BEHIND = 20;

// ---------------------------------------------------------------------------------------------
// Report shape, parsing and suggestions: pure, and covered by status.test.ts
// ---------------------------------------------------------------------------------------------

export interface Worktree {
    path: string;
    branch: string | null;
    detached: boolean;
    prunable: boolean;
}

export interface Pr {
    number: number;
    url: string;
    isDraft: boolean;
    ci: "pass" | "fail" | "pending" | "none";
    review: string | null;
    autoMerge: boolean;
}

export interface Branch {
    name: string;
    /** Commits on the branch that the base doesn't have, and the reverse. */
    ahead: number;
    behind: number;
    /** Everything on the branch is in the base (merge commits only here, so ancestry is exact). */
    merged: boolean;
    onRemote: boolean;
    /** Commits not on origin/<name>; all of `ahead` when the branch was never pushed. */
    unpushed: number;
    lastCommit: { unix: number; subject: string };
    worktree: Checkout | null;
    pr: Pr | null;
}

export interface Checkout {
    name: string;
    path: string;
    isMain: boolean;
    branch: string | null;
    changes: number;
    port: number | null;
    serverUp: boolean;
    database: string | null;
    prunable: boolean;
}

export interface Stash {
    ref: string;
    age: string;
    message: string;
}

export interface Report {
    fetched: boolean;
    github: boolean;
    base: { name: string; localBehind: number };
    checkouts: Checkout[];
    branches: Branch[];
    stashes: Stash[];
    servers: Array<{ port: number; owner: string }>;
}

export interface Suggestion {
    what: string;
    command?: string;
    /** Deletes something (a worktree, a branch, a stash); the skill confirms before running it. */
    destructive: boolean;
}

export function parseWorktrees(porcelain: string): Worktree[] {
    return porcelain
        .split("\n\n")
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => {
            const lines = block.split("\n");
            const get = (key: string) => lines.find((l) => l === key || l.startsWith(`${key} `));
            const branchLine = get("branch");
            return {
                path: get("worktree")!.slice("worktree ".length),
                branch: branchLine ? branchLine.slice("branch refs/heads/".length) : null,
                detached: get("detached") !== undefined,
                prunable: get("prunable") !== undefined,
            };
        });
}

/** `POSTGRES_DATABASE` from a .env.local, quotes stripped. */
export function databaseFromEnv(text: string): string | null {
    const m = /^POSTGRES_DATABASE="?([^"\n]+)"?/m.exec(text);
    return m ? m[1].trim() : null;
}

interface RollupItem {
    status?: string;
    conclusion?: string;
    state?: string;
}

export function ciState(rollup: RollupItem[]): Pr["ci"] {
    if (rollup.length === 0) return "none";
    const outcome = (c: RollupItem) => (c.conclusion || c.state || c.status || "").toUpperCase();
    const outcomes = rollup.map(outcome);
    if (outcomes.some((o) => ["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED"].includes(o)))
        return "fail";
    if (outcomes.some((o) => ["", "PENDING", "QUEUED", "IN_PROGRESS", "EXPECTED", "WAITING"].includes(o)))
        return "pending";
    return "pass";
}

export function suggest(r: Report): Suggestion[] {
    const out: Suggestion[] = [];

    if (r.base.localBehind > 0) {
        const checkedOut = r.checkouts.some((c) => c.branch === r.base.name);
        out.push({
            what: `local ${r.base.name} is ${r.base.localBehind} behind origin`,
            command: checkedOut ? `git pull --ff-only` : `git branch -f ${r.base.name} origin/${r.base.name}`,
            destructive: false,
        });
    }

    for (const c of r.checkouts) {
        if (c.prunable) {
            out.push({ what: `worktree ${c.name}'s directory is gone`, command: "git worktree prune", destructive: true });
            continue;
        }
        const b = r.branches.find((x) => x.name === c.branch);
        if (!c.isMain && b?.merged && b.ahead === 0 && c.changes === 0 && !b.pr) {
            const db = c.database && c.database !== "avut" ? ` (drops its branch DB ${c.database})` : "";
            out.push({
                what: `${c.name}: ${b.name} is merged into ${r.base.name} and the tree is clean${db}`,
                command: `npm run worktree:remove ${c.name} && git branch -d ${b.name}`,
                destructive: true,
            });
        }
        if (c.port === 3100 && c.serverUp) {
            out.push({ what: "an agent's dev server is still up on 3100 — it blocks the user's `npm run dev` if 3000 is down", destructive: false });
        }
    }

    for (const b of r.branches) {
        if (!b.worktree && b.merged && !b.pr) {
            out.push({
                what: `${b.name} is merged into ${r.base.name}`,
                command: `git branch -d ${b.name}${b.onRemote ? ` && git push origin --delete ${b.name}` : ""}`,
                destructive: true,
            });
        }
        // hotfix/* branches come off production (docs/releasing.md), so integration isn't theirs to merge.
        if (!b.merged && b.behind > STALE_BEHIND && !b.name.startsWith("hotfix/")) {
            out.push({
                what: `${b.name} is ${b.behind} behind ${r.base.name}`,
                command: b.worktree
                    ? `git -C ${b.worktree.isMain ? "." : `.claude/worktrees/${b.worktree.name}`} merge origin/${r.base.name}`
                    : `git switch ${b.name} && git merge origin/${r.base.name}`,
                destructive: false,
            });
        }
        if (b.pr?.ci === "fail") {
            out.push({ what: `#${b.pr.number} (${b.name}) is failing CI`, destructive: false });
        }
        if (b.name.startsWith("plan/")) {
            out.push({ what: `plan waiting: ${b.name}`, command: `/avut-develop-feature ${b.name}`, destructive: false });
        }
    }

    return out;
}

// ---------------------------------------------------------------------------------------------
// Gathering
// ---------------------------------------------------------------------------------------------

function run(cmd: string, args: string[], cwd?: string): string {
    return execFileSync(cmd, args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"] });
}

function tryRun(cmd: string, args: string[], cwd?: string): { ok: boolean; out: string } {
    const r = spawnSync(cmd, args, { encoding: "utf8", cwd });
    return { ok: r.status === 0, out: r.stdout ?? "" };
}

function counts(range: string): [number, number] {
    const [left, right] = run("git", ["rev-list", "--left-right", "--count", range]).trim().split(/\s+/).map(Number);
    return [left, right];
}

function listeningPorts(): Set<number> {
    // -F n: one "n<addr>:<port>" line per socket. No lsof (or no permission) means no servers found.
    const { out } = tryRun("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fn"]);
    const ports = new Set<number>();
    for (const line of out.split("\n")) {
        const m = /^n.*:(\d+)$/.exec(line);
        if (m) ports.add(Number(m[1]));
    }
    return ports;
}

function openPrs(): Map<string, Pr> | null {
    const r = tryRun("gh", [
        "pr", "list", "--repo", REPO, "--state", "open", "--limit", "100",
        "--json", "number,url,headRefName,isDraft,reviewDecision,autoMergeRequest,statusCheckRollup",
    ]);
    if (!r.ok) return null;
    const rows = JSON.parse(r.out) as Array<{
        number: number;
        url: string;
        headRefName: string;
        isDraft: boolean;
        reviewDecision: string | null;
        autoMergeRequest: unknown;
        statusCheckRollup: RollupItem[] | null;
    }>;
    return new Map(
        rows.map((p) => [
            p.headRefName,
            {
                number: p.number,
                url: p.url,
                isDraft: p.isDraft,
                ci: ciState(p.statusCheckRollup ?? []),
                review: p.reviewDecision || null,
                autoMerge: Boolean(p.autoMergeRequest),
            },
        ]),
    );
}

export function gather(opts: { fetch: boolean; github: boolean }): Report {
    const commonDir = run("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
    const root = join(commonDir, "..");

    let fetched = false;
    if (opts.fetch) fetched = tryRun("git", ["fetch", "--quiet", "--prune", "origin"], root).ok;

    const ports = listeningPorts();
    const prs = opts.github ? openPrs() : null;

    const checkouts: Checkout[] = parseWorktrees(run("git", ["worktree", "list", "--porcelain"])).map((w) => {
        const isMain = w.path === root;
        const portFile = join(w.path, ".dev-port");
        const port = isMain ? 3000 : existsSync(portFile) ? Number(readFileSync(portFile, "utf8").trim()) : null;
        const envFile = join(w.path, ".env.local");
        const changes = w.prunable
            ? 0
            : tryRun("git", ["status", "--porcelain"], w.path).out.split("\n").filter(Boolean).length;
        return {
            name: isMain ? "main" : basename(w.path),
            path: w.path,
            isMain,
            branch: w.branch,
            changes,
            // The main checkout's agent server is on 3100 when the user's 3000 is down.
            port: isMain && !ports.has(3000) && ports.has(3100) ? 3100 : port,
            serverUp: port !== null && (ports.has(port) || (isMain && ports.has(3100))),
            database: existsSync(envFile) ? databaseFromEnv(readFileSync(envFile, "utf8")) : null,
            prunable: w.prunable,
        };
    });

    const refs = run("git", [
        "for-each-ref", "--format=%(refname:short)%00%(committerdate:unix)%00%(subject)", "refs/heads",
    ])
        .split("\n")
        .filter(Boolean)
        .map((line) => line.split("\0"));

    const base = `origin/${BASE}`;
    const branches: Branch[] = refs
        .filter(([name]) => !LONG_LIVED.has(name))
        .map(([name, unix, subject]) => {
            const [behind, ahead] = counts(`${base}...${name}`);
            const onRemote = tryRun("git", ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${name}`]).ok;
            const unpushed = onRemote ? Number(run("git", ["rev-list", "--count", `origin/${name}..${name}`]).trim()) : ahead;
            return {
                name,
                ahead,
                behind,
                merged: ahead === 0,
                onRemote,
                unpushed,
                lastCommit: { unix: Number(unix), subject },
                worktree: checkouts.find((c) => c.branch === name) ?? null,
                pr: prs?.get(name) ?? null,
            };
        })
        .sort((a, b) => b.lastCommit.unix - a.lastCommit.unix);

    const localBase = tryRun("git", ["rev-parse", "--verify", "--quiet", BASE]).ok;
    const localBehind = localBase ? counts(`${BASE}...${base}`)[1] : 0;

    const stashes = run("git", ["stash", "list", "--format=%gd%x00%cr%x00%gs"])
        .split("\n")
        .filter(Boolean)
        .map((line) => {
            const [ref, age, message] = line.split("\0");
            return { ref, age, message };
        });

    const owners = new Map<number, string>([
        [3000, "user (main checkout)"],
        [3001, "user (dev-email)"],
        [3100, "agent (main checkout)"],
    ]);
    for (const c of checkouts) if (!c.isMain && c.port) owners.set(c.port, `worktree ${c.name}`);
    const servers = [...owners].filter(([port]) => ports.has(port)).map(([port, owner]) => ({ port, owner }));

    return {
        fetched,
        github: prs !== null,
        base: { name: BASE, localBehind },
        checkouts,
        branches,
        stashes,
        servers,
    };
}

// ---------------------------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------------------------

function ago(unix: number): string {
    const days = Math.floor((Date.now() / 1000 - unix) / 86400);
    return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

function vsBase(b: Branch | undefined): string {
    if (!b) return "—";
    if (b.merged) return "merged";
    return `↑${b.ahead} ↓${b.behind}`;
}

function push(b: Branch | undefined): string {
    if (!b) return "—";
    if (!b.onRemote) return b.ahead ? "not pushed" : "—";
    return b.unpushed ? `${b.unpushed} unpushed` : "pushed";
}

function pr(p: Pr | null | undefined, github: boolean): string {
    if (!github) return "?";
    if (!p) return "—";
    const bits = [`#${p.number}`, p.isDraft ? "draft" : null, `CI ${p.ci}`, p.review?.toLowerCase().replace("_", " "), p.autoMerge ? "auto-merge" : null];
    return bits.filter(Boolean).join(", ");
}

export function toMarkdown(r: Report, suggestions: Suggestion[]): string {
    const lines: string[] = [];
    const row = (cells: Array<string | number>) => lines.push(`| ${cells.join(" | ")} |`);

    if (!r.fetched) lines.push(`_Not fetched: numbers are as of the last \`git fetch\`._\n`);

    lines.push("## Checkouts\n");
    row(["Checkout", "Branch", "Changes", `vs ${r.base.name}`, "Push", "PR", "Port", "DB"]);
    row(["---", "---", "---", "---", "---", "---", "---", "---"]);
    for (const c of r.checkouts) {
        const b = r.branches.find((x) => x.name === c.branch);
        const branch = c.branch ?? "(detached)";
        const vs = c.branch && LONG_LIVED.has(c.branch) ? "—" : vsBase(b);
        row([
            c.prunable ? `${c.name} (gone)` : c.name,
            branch,
            c.changes ? `${c.changes} file${c.changes === 1 ? "" : "s"}` : "clean",
            vs,
            push(b),
            pr(b?.pr, r.github),
            c.port ? `${c.port}${c.serverUp ? " ●" : ""}` : "—",
            c.database ?? "—",
        ]);
    }

    const loose = r.branches.filter((b) => !b.worktree);
    if (loose.length) {
        lines.push("\n## Branches without a worktree\n");
        row(["Branch", "Last commit", `vs ${r.base.name}`, "Push", "PR"]);
        row(["---", "---", "---", "---", "---"]);
        for (const b of loose) row([b.name, ago(b.lastCommit.unix), vsBase(b), push(b), pr(b.pr, r.github)]);
    }

    if (r.stashes.length) {
        lines.push("\n## Stashes\n");
        for (const s of r.stashes) lines.push(`- \`${s.ref}\` (${s.age}): ${s.message}`);
    }

    lines.push("\n## Dev servers\n");
    lines.push(r.servers.length ? r.servers.map((s) => `- ${s.port}: ${s.owner}`).join("\n") : "- none running");

    lines.push("\n## Suggestions\n");
    if (!suggestions.length) lines.push("- nothing to tidy");
    for (const s of suggestions) lines.push(`- ${s.destructive ? "🗑 " : ""}${s.what}${s.command ? ` — \`${s.command}\`` : ""}`);

    return lines.join("\n") + "\n";
}

if (import.meta.main) {
    const args = new Set(process.argv.slice(2));
    const offline = args.has("--offline");
    const report = gather({ fetch: !offline && !args.has("--no-fetch"), github: !offline });
    const suggestions = suggest(report);
    process.stdout.write(
        args.has("--json") ? JSON.stringify({ ...report, suggestions }, null, 2) + "\n" : toMarkdown(report, suggestions),
    );
}
