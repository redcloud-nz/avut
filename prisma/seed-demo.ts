/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Local development seed: a self-contained demo organisation populated for Skill
 * Track screenshots (session views + currency reports) and day-to-day manual testing.
 *
 *   npm run seed:demo
 *
 * Idempotent — the org is keyed on the slug `demo`; every run deletes it (cascades
 * wipe all its data) plus the `@demo.avut.nz` demo users, then rebuilds from a
 * seeded PRNG so the generated grid is identical each time. Nothing else in the
 * database is touched. Refuses to run against a production-looking database
 * unless `--force` is passed.
 *
 * NOTE: this seed does NOT author its own skill package. It subscribes the demo org
 * to the published packages owned by the `nzrt-sg` organisation, which is how a real
 * org consumes a package. That makes the seed dependent on `nzrt-sg` and its packages
 * already existing in the target database — on a fresh database it fails with a clear
 * error rather than inventing a package. It never writes to `nzrt-sg`.
 */

import "dotenv/config";

import { hashPassword } from "better-auth/crypto";

import { Prisma } from "@/generated/prisma/client";
import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { OrganizationUserId } from "@/lib/schemas/organization-user";
import { PersonId } from "@/lib/schemas/person";
import { SkillCheckId } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import prisma from "@/server/prisma";

const DEMO_SLUG = "demo";
const DEMO_ORG_NAME = "Erehwon CDEM";
const DEMO_TEAM_NAME = "Erehwon Response Team";
const EMAIL_DOMAIN = "demo.avut.nz";
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? "erehwon-demo";

/** The organisation whose published packages the demo org subscribes to. */
const PACKAGE_PUBLISHER_SLUG = "nzrt-sg";

/** One session per month, this month back through `SESSION_COUNT - 1` months ago. */
const SESSION_COUNT = 15;

/** Skill groups covered by each monthly session. Coprime with the group count so the
 *  rotation walks every group evenly instead of revisiting a subset. */
const GROUPS_PER_SESSION = 3;

/**
 * Responders who have drifted — indices into `PERSONNEL_NAMES` who stopped turning up
 * `DRIFT_MONTHS` ago and have attended nothing since.
 *
 * Named explicitly rather than left to emerge from the PRNG. Without them the roster is
 * uniformly current: the rotation revisits every group roughly every four months, well
 * inside the 12-month reassessment frequency, so a responder would have to miss the same
 * group three times running to lapse. These five give the currency report whole lapsed
 * rows — legible in a screenshot, and a real case to test filters and reports against.
 */
const DRIFTED_INDICES = [7, 13, 20, 26, 30];

/** How long ago the drifted cohort stopped attending. Longer than the 12-month
 *  frequency on all but four skills would be total dropout; this leaves them partly
 *  current and partly lapsed, which is the more interesting shape. */
const DRIFT_MONTHS = 9;

/** Share of a session's planned skills that never actually get run — the night overruns,
 *  the weather turns, the trainer is short-handed. They stay attached to the session
 *  because they were on the plan, so they read as an uncovered column rather than
 *  vanishing from the record. */
const MISSED_SKILL_RATE = 0.15;

/** Deterministic PRNG (mulberry32) so re-runs produce an identical dataset. */
function makeRng(seed: number) {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rng = makeRng(0x4756_5554);

function pickWeighted<T>(entries: [T, number][]): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = rng() * total;
    for (const [value, weight] of entries) {
        if ((r -= weight) < 0) return value;
    }
    return entries[entries.length - 1][0];
}

function pick<T>(items: T[]): T {
    return items[Math.floor(rng() * items.length)];
}

/** A training night: the 12th of the month, 19:00 local. */
function sessionDate(monthsAgo: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    d.setDate(12);
    d.setHours(19, 0, 0, 0);
    return d;
}

// --- Fictional personnel -----------------------------------------------------

/**
 * 32 responders — a mix of English, New Zealand and European names, so the roster
 * looks like a real CDEM team rather than a generated grid. Written out literally
 * rather than assembled from name pools: the pairings stay plausible, and the list
 * is stable without depending on the PRNG.
 */
const PERSONNEL_NAMES = [
    "Harriet Blackwood",
    "Aroha Te Whata",
    "Douglas Renshaw",
    "Lukas Brandt",
    "Oliver Pennington",
    "Rewi Panapa",
    "Sofia Marchetti",
    "Rosie Fairbairn",
    "Mereana Kingi",
    "Anneke de Vries",
    "Callum Hartley",
    "Tama Ropata",
    "Mateusz Kowalczyk",
    "Imogen Radcliffe",
    "Kahurangi Waititi",
    "Camille Fourcade",
    "Toby Winslow",
    "Manaia Tukaki",
    "Jonas Lindqvist",
    "Eleanor Whitcombe",
    "Hine Paraone",
    "Marek Dvorak",
    "George Ashworth",
    "Rangi Ngawaka",
    "Ines Oliveira",
    "Freya Milburn",
    "Anaru Heremaia",
    "Katarina Novak",
    "Martha Sedgwick",
    "Moana Rahui",
    "Pieter Janssen",
    "Wiremu Tahau",
] as const;

/** Indices into `PERSONNEL_NAMES` who assess. One of them runs each session. */
const ASSESSOR_INDICES = [0, 1, 2, 3];

interface PersonSpec {
    id: string;
    name: string;
    email: string;
    isAssessor: boolean;
    /** Stopped attending `DRIFT_MONTHS` ago — see `DRIFTED_INDICES`. */
    hasDrifted: boolean;
}

/** `Aroha Te Whata` -> `aroha.tewhata` — diacritics stripped, surname spaces closed up. */
function emailLocalPart(name: string): string {
    const [first, ...rest] = name.split(" ");
    const ascii = (s: string) =>
        s
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-zA-Z]/g, "")
            .toLowerCase();
    return `${ascii(first)}.${ascii(rest.join(""))}`;
}

function buildPersonnel(): PersonSpec[] {
    return PERSONNEL_NAMES.map((name, i) => ({
        id: PersonId.create(),
        name,
        email: `${emailLocalPart(name)}@${EMAIL_DOMAIN}`,
        isAssessor: ASSESSOR_INDICES.includes(i),
        hasDrifted: DRIFTED_INDICES.includes(i),
    }));
}

// --- Seed steps ------------------------------------------------------------

function assertSafeTarget() {
    const raw = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL ?? "";
    let host = raw;
    try {
        host = new URL(raw).host;
    } catch {
        /* keep raw */
    }
    const local = /^(localhost|127\.0\.0\.1|host\.docker\.internal|db|postgres)(:\d+)?$/.test(host);
    const forced = process.argv.includes("--force");
    if (!local && !forced) {
        throw new Error(
            `Refusing to seed a non-local database (host: ${host || "unknown"}). ` +
                `Re-run with --force if you are certain.`,
        );
    }
    console.log(`Seeding demo org into database host: ${host || "unknown"}`);
}

async function wipe() {
    const existing = await prisma.organization.findUnique({
        where: { slug: DEMO_SLUG },
        select: { id: true },
    });
    if (existing) {
        await prisma.organization.delete({ where: { id: existing.id } });
        console.log("  removed existing demo org");
    }
    const { count } = await prisma.user.deleteMany({
        where: { email: { endsWith: `@${EMAIL_DOMAIN}` } },
    });
    if (count) console.log(`  removed ${count} existing demo user(s)`);
}

async function createOrg(): Promise<string> {
    const organizationId = OrganizationId.create();
    const settings = OrganizationSettings.default();
    settings.modules["skill-track"].enabled = true;

    const configRows = Object.entries(OrganizationSettings.flatten(settings)).map(
        ([key, value]) => ({
            organizationId,
            key,
            value: value as Prisma.InputJsonValue,
        }),
    );

    await prisma.$transaction([
        prisma.organization.create({
            data: {
                id: organizationId,
                name: DEMO_ORG_NAME,
                slug: DEMO_SLUG,
                createdAt: sessionDate(SESSION_COUNT),
            },
        }),
        ...configRows.map((data) => prisma.organizationConfig.create({ data })),
    ]);
    console.log(`  org ${DEMO_ORG_NAME} (/orgs/${DEMO_SLUG})`);
    return organizationId;
}

async function createUsers(
    organizationId: string,
    personnel: PersonSpec[],
): Promise<Map<string, string>> {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const byName = new Map(personnel.map((p) => [p.name, p.id]));

    async function createLogin(email: string, name: string) {
        const userId = nanoId16();
        const now = new Date();
        await prisma.user.create({
            data: {
                id: userId,
                name,
                email,
                emailVerified: true,
                createdAt: now,
                updatedAt: now,
                accounts: {
                    create: {
                        id: nanoId16(),
                        accountId: userId,
                        providerId: "credential",
                        password: passwordHash,
                        createdAt: now,
                        updatedAt: now,
                    },
                },
            },
        });
        return userId;
    }

    const logins: { email: string; name: string; role: string; personName: string | null }[] = [
        {
            email: `owner@${EMAIL_DOMAIN}`,
            name: "Demo Owner",
            role: "owner",
            personName: "Harriet Blackwood",
        },
        {
            email: `assessor@${EMAIL_DOMAIN}`,
            name: "Demo Assessor",
            role: "skills-assessor",
            personName: "Aroha Te Whata",
        },
        {
            // A member who IS on the roster — the "my own skills" case.
            email: `responder@${EMAIL_DOMAIN}`,
            name: "Demo Responder",
            role: "member",
            personName: "Toby Winslow",
        },
        {
            // A member with no Person record — the user-vs-person edge case.
            email: `member@${EMAIL_DOMAIN}`,
            name: "Demo Member",
            role: "member",
            personName: null,
        },
    ];

    const userIdByEmail = new Map<string, string>();
    for (const login of logins) {
        const userId = await createLogin(login.email, login.name);
        userIdByEmail.set(login.email, userId);
        await prisma.organizationUser.create({
            data: {
                id: OrganizationUserId.create(),
                organizationId,
                userId,
                role: login.role,
                personId: login.personName ? (byName.get(login.personName) ?? null) : null,
                createdAt: new Date(),
            },
        });
        const linked = login.personName ? ` -> ${login.personName}` : " (no person record)";
        console.log(`  login ${login.email} (${login.role})${linked} — password: ${DEMO_PASSWORD}`);
    }
    return userIdByEmail;
}

async function createPeopleAndTeam(organizationId: string, personnel: PersonSpec[]) {
    await prisma.person.createMany({
        data: personnel.map((p) => ({
            id: p.id,
            organizationId,
            name: p.name,
            email: p.email,
            tags: p.isAssessor ? ["assessor"] : [],
        })),
    });

    const teamId = TeamId.create();
    await prisma.team.create({
        data: {
            id: teamId,
            organizationId,
            name: DEMO_TEAM_NAME,
            description: "Erehwon's volunteer response team.",
        },
    });

    await prisma.teamMembership.createMany({
        data: personnel.map((p) => ({
            id: TeamMembershipId.create(),
            organizationId,
            teamId,
            personId: p.id,
        })),
    });
    console.log(`  ${personnel.length} personnel, all in team "${DEMO_TEAM_NAME}"`);
}

interface SeedSkillGroup {
    id: string;
    name: string;
    packageName: string;
    skillIds: string[];
}

/**
 * Subscribe the demo org to every published package owned by `nzrt-sg`, and return
 * that catalogue's groups (each with its active skills) in package/sequence order.
 */
async function subscribeToPackages(organizationId: string): Promise<SeedSkillGroup[]> {
    const publisher = await prisma.organization.findUnique({
        where: { slug: PACKAGE_PUBLISHER_SLUG },
        select: { id: true, name: true },
    });
    if (!publisher) {
        throw new Error(
            `This seed subscribes the demo org to the published skill packages owned by ` +
                `"${PACKAGE_PUBLISHER_SLUG}", but no organisation with that slug exists in this ` +
                `database. Restore or create it before seeding.`,
        );
    }

    const packages = await prisma.skillPackage.findMany({
        where: { organizationId: publisher.id, published: true, status: "Active" },
        select: {
            id: true,
            name: true,
            groups: {
                where: { status: "Active" },
                select: {
                    id: true,
                    name: true,
                    sequence: true,
                    skills: {
                        where: { status: "Active" },
                        select: { id: true },
                        orderBy: { sequence: "asc" },
                    },
                },
                orderBy: { sequence: "asc" },
            },
        },
        orderBy: { name: "asc" },
    });
    if (packages.length === 0) {
        throw new Error(
            `Organisation "${publisher.name}" (${PACKAGE_PUBLISHER_SLUG}) has no published, ` +
                `active skill packages to subscribe to.`,
        );
    }

    await prisma.skillPackageSubscription.createMany({
        data: packages.map((pkg) => ({
            id: nanoId16(),
            organizationId,
            skillPackageId: pkg.id,
        })),
    });

    const groups: SeedSkillGroup[] = [];
    for (const pkg of packages) {
        for (const group of pkg.groups) {
            if (group.skills.length === 0) continue;
            groups.push({
                id: group.id,
                name: group.name,
                packageName: pkg.name,
                skillIds: group.skills.map((s) => s.id),
            });
        }
    }

    const skillCount = groups.reduce((n, g) => n + g.skillIds.length, 0);
    console.log(
        `  subscribed to ${packages.length} package(s) from ${publisher.name}: ` +
            `${packages.map((p) => p.name).join(", ")} — ${groups.length} groups, ${skillCount} skills`,
    );
    return groups;
}

const RESULT_WEIGHTS: [string, number][] = [
    ["Pass", 45],
    ["StrongPass", 28],
    ["NotTaught", 15],
    ["Fail", 12],
];

/** Short assessor remarks, attached only to checks that did not pass. */
const FAIL_NOTES = [
    "Ran out of time on the night — rebook.",
    "Sequence correct, needs to be quicker under load.",
    "Not covered this session.",
    "Close. Reassess at the next training night.",
    "Needs a refresher before signing off.",
];

async function createSessions(
    organizationId: string,
    personnel: PersonSpec[],
    groups: SeedSkillGroup[],
) {
    const assessorPool = personnel.filter((p) => p.isAssessor);

    let totalChecks = 0;

    for (let i = 0; i < SESSION_COUNT; i++) {
        // Oldest first, so session numbers read chronologically.
        const monthsAgo = SESSION_COUNT - 1 - i;
        const when = sessionDate(monthsAgo);
        const isCurrent = monthsAgo === 0;

        // One assessor per session, rotating through the pool.
        const assessor = assessorPool[i % assessorPool.length];

        // Rotate a fixed-size window of groups. GROUPS_PER_SESSION is coprime with 13
        // groups today, so the window walks the whole catalogue evenly.
        const sessionGroups = Array.from(
            { length: GROUPS_PER_SESSION },
            (_, k) => groups[(i * GROUPS_PER_SESSION + k) % groups.length],
        );
        const plannedSkillIds = [...new Set(sessionGroups.flatMap((g) => g.skillIds))];

        // A few planned skills never get run. They stay on the session (below), so the
        // session view shows them uncovered rather than pretending they weren't planned.
        const assessedSkillIds = plannedSkillIds.filter(() => rng() >= MISSED_SKILL_RATE);
        // Guard the degenerate draw — a session that assessed nothing at all isn't useful.
        if (assessedSkillIds.length === 0) assessedSkillIds.push(plannedSkillIds[0]);
        const missedCount = plannedSkillIds.length - assessedSkillIds.length;

        // Not everyone makes every training night, and the assessor doesn't assess themselves.
        // The drifted cohort stops appearing once the session is inside their drift window.
        const eligible = personnel.filter(
            (p) => p.id !== assessor.id && !(p.hasDrifted && monthsAgo < DRIFT_MONTHS),
        );
        const attendanceRate = 0.6 + rng() * 0.25;
        const assessees = eligible.filter(() => rng() < attendanceRate);

        const name = `${when.toLocaleString("en-NZ", { month: "long" })} ${when.getFullYear()} Training Night`;

        const sessionId = SkillCheckSessionId.create();
        await prisma.skillCheckSession.create({
            data: {
                id: sessionId,
                organizationId,
                name,
                sessionNumber: i + 1,
                status: "Include",
                startsAt: when,
                endsAt: isCurrent ? null : when,
                // Nullable in the DB, but the app's Zod schema requires a string.
                notes: isCurrent ? "" : `Covered ${sessionGroups.map((g) => g.name).join(", ")}.`,
                assessees: { connect: assessees.map((p) => ({ id: p.id })) },
                assessors: { connect: [{ id: assessor.id }] },
                skills: { connect: plannedSkillIds.map((id) => ({ id })) },
            },
        });

        // A finished night is nearly complete; the current one is still being filled in —
        // that partial grid is the in-progress hero shot.
        const fillRatio = isCurrent ? 0.55 : 0.9 + rng() * 0.1;

        const checks: Prisma.SkillCheckCreateManyInput[] = [];
        for (const assessee of assessees) {
            for (const skillId of assessedSkillIds) {
                if (rng() > fillRatio) continue;
                const result = pickWeighted(RESULT_WEIGHTS);
                checks.push({
                    id: SkillCheckId.create(),
                    organizationId,
                    sessionId,
                    assesseeId: assessee.id,
                    assessorId: assessor.id,
                    skillId,
                    result: result as Prisma.SkillCheckCreateManyInput["result"],
                    notes: result === "Pass" || result === "StrongPass" ? "" : pick(FAIL_NOTES),
                    status: "Include",
                    createdAt: when,
                });
            }
        }
        await prisma.skillCheck.createMany({ data: checks });
        totalChecks += checks.length;

        console.log(
            `  session ${i + 1}: "${name}" — ${assessees.length} assessees, ` +
                `${plannedSkillIds.length} skills (${missedCount} not covered), ` +
                `${checks.length} checks${isCurrent ? " (in progress)" : ""}`,
        );
    }

    console.log(`  ${SESSION_COUNT} sessions, ${totalChecks} checks total`);
}

async function main() {
    assertSafeTarget();
    console.log("Wiping any previous demo data…");
    await wipe();

    console.log("Building demo org…");
    const organizationId = await createOrg();

    const personnel = buildPersonnel();
    await createPeopleAndTeam(organizationId, personnel);
    await createUsers(organizationId, personnel);

    const groups = await subscribeToPackages(organizationId);
    await createSessions(organizationId, personnel, groups);

    console.log("\nDone. Sign in at /auth/sign-in as one of the demo logins above.");
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
        console.error(err);
        await prisma.$disconnect();
        process.exit(1);
    });
