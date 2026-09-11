/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Local development seed: a self-contained demo organisation populated for Skill
 * Track screenshots (session view + currency report).
 *
 *   npm run seed:demo
 *
 * Idempotent — the org is keyed on the slug `demo`; every run deletes it (cascades
 * wipe all its data) plus the `@demo.avut.nz` demo users, then rebuilds from a
 * seeded PRNG so the generated grid is identical each time. Nothing else in the
 * database is touched. Refuses to run against a production-looking database
 * unless `--force` is passed.
 */

import "dotenv/config";

import { hashPassword } from "better-auth/crypto";

import { Prisma } from "@/generated/prisma/client";
import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { OrganizationUserId } from "@/lib/schemas/organization-user";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckId } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import prisma from "@/server/prisma";

const DEMO_SLUG = "demo";
const DEMO_ORG_NAME = "Erehwon Response Team";
const EMAIL_DOMAIN = "demo.avut.nz";
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? "erehwon-demo";

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

function monthsAgo(months: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d;
}

// --- Fictional personnel -----------------------------------------------------

const FIRST_NAMES = [
    "Ari",
    "Bex",
    "Cai",
    "Devi",
    "Esa",
    "Finn",
    "Goro",
    "Hana",
    "Ivo",
    "Juno",
    "Kaia",
    "Lio",
    "Mira",
    "Noa",
    "Otis",
    "Priya",
    "Quin",
    "Rangi",
    "Suki",
    "Tama",
];
const LAST_NAMES = [
    "Ashford",
    "Beckett",
    "Calder",
    "Doyle",
    "Elms",
    "Frost",
    "Greer",
    "Holt",
    "Innes",
    "Jarrah",
    "Keeling",
    "Lund",
    "Mercer",
    "Nash",
    "Okafor",
    "Pratt",
    "Quill",
    "Rowe",
    "Sowden",
    "Trent",
];

interface PersonSpec {
    id: string;
    name: string;
    email: string;
    isAssessor: boolean;
}

function buildPersonnel(): PersonSpec[] {
    const used = new Set<string>();
    const people: PersonSpec[] = [];
    // First two are the assessors — they get linked to the owner/assessor logins.
    for (let i = 0; i < 14; i++) {
        let first: string, last: string, key: string;
        do {
            first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
            last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
            key = `${first} ${last}`;
        } while (used.has(key));
        used.add(key);
        people.push({
            id: PersonId.create(),
            name: key,
            email: `${first.toLowerCase()}.${last.toLowerCase()}@${EMAIL_DOMAIN}`,
            isAssessor: i < 2,
        });
    }
    return people;
}

// --- Skill package ----------------------------------------------------------

const SKILL_GROUPS: {
    name: string;
    description: string;
    skills: { name: string; frequency: number }[];
}[] = [
    {
        name: "Anchors & Rigging",
        description: "Building and evaluating anchor systems.",
        skills: [
            { name: "Natural & artificial anchors", frequency: 12 },
            { name: "Load-sharing anchors", frequency: 12 },
            { name: "Mechanical advantage systems", frequency: 24 },
        ],
    },
    {
        name: "Ascending & Descending",
        description: "Personal rope movement under load.",
        skills: [
            { name: "Controlled descent", frequency: 12 },
            { name: "Rope ascent & changeovers", frequency: 12 },
        ],
    },
    {
        name: "Rescue Systems",
        description: "Moving a subject on rope.",
        skills: [
            { name: "Pick-off rescue", frequency: 12 },
            { name: "Litter attendant on steep ground", frequency: 24 },
        ],
    },
];

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
                createdAt: new Date(),
            },
        }),
        ...configRows.map((data) => prisma.organizationConfig.create({ data })),
    ]);
    console.log(`  org ${DEMO_ORG_NAME} (/orgs/${DEMO_SLUG})`);
    return organizationId;
}

async function createUsers(
    organizationId: string,
    ownerPersonId: string,
    assessorPersonId: string,
) {
    const passwordHash = await hashPassword(DEMO_PASSWORD);

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

    const logins: { email: string; name: string; role: string; personId: string | null }[] = [
        {
            email: `owner@${EMAIL_DOMAIN}`,
            name: "Demo Owner",
            role: "owner",
            personId: ownerPersonId,
        },
        {
            email: `assessor@${EMAIL_DOMAIN}`,
            name: "Demo Assessor",
            role: "skills-assessor",
            personId: assessorPersonId,
        },
        { email: `member@${EMAIL_DOMAIN}`, name: "Demo Member", role: "member", personId: null },
    ];

    for (const login of logins) {
        const userId = await createLogin(login.email, login.name);
        await prisma.organizationUser.create({
            data: {
                id: OrganizationUserId.create(),
                organizationId,
                userId,
                role: login.role,
                personId: login.personId,
                createdAt: new Date(),
            },
        });
        console.log(`  login ${login.email} (${login.role}) — password: ${DEMO_PASSWORD}`);
    }
}

async function createPeopleAndTeams(organizationId: string, personnel: PersonSpec[]) {
    await prisma.person.createMany({
        data: personnel.map((p) => ({
            id: p.id,
            organizationId,
            name: p.name,
            email: p.email,
            tags: p.isAssessor ? ["assessor"] : [],
        })),
    });

    const teams = ["Rope Rescue", "Swiftwater", "USAR"].map((name) => ({
        id: TeamId.create(),
        name,
    }));
    await prisma.team.createMany({
        data: teams.map((t) => ({ id: t.id, organizationId, name: t.name })),
    });

    await prisma.teamMembership.createMany({
        data: personnel.map((p, i) => ({
            id: TeamMembershipId.create(),
            organizationId,
            teamId: teams[i % teams.length].id,
            personId: p.id,
        })),
    });
    console.log(`  ${personnel.length} personnel across ${teams.length} teams`);
}

async function createSkillPackage(organizationId: string): Promise<string[]> {
    const skillPackageId = SkillPackageId.create();
    await prisma.skillPackage.create({
        data: {
            id: skillPackageId,
            organizationId,
            name: "Rope Rescue Technician",
            description: "Core rope-rescue competencies assessed on a rolling cycle.",
            published: true,
        },
    });

    const skillIds: string[] = [];
    for (const [g, group] of SKILL_GROUPS.entries()) {
        const skillGroupId = SkillGroupId.create();
        await prisma.skillGroup.create({
            data: {
                id: skillGroupId,
                skillPackageId,
                name: group.name,
                description: group.description,
                sequence: g,
            },
        });
        await prisma.skill.createMany({
            data: group.skills.map((skill, s) => {
                const id = SkillId.create();
                skillIds.push(id);
                return {
                    id,
                    skillPackageId,
                    skillGroupId,
                    name: skill.name,
                    description: `Demonstrate: ${skill.name.toLowerCase()}.`,
                    sequence: s,
                    frequency: skill.frequency,
                };
            }),
        });
    }

    await prisma.skillPackageSubscription.create({
        data: { id: nanoId16(), organizationId, skillPackageId },
    });
    console.log(`  skill package "Rope Rescue Technician" — ${skillIds.length} skills`);
    return skillIds;
}

const RESULT_WEIGHTS: [string, number][] = [
    ["Pass", 45],
    ["StrongPass", 28],
    ["NotTaught", 15],
    ["Fail", 12],
];

async function createSessions(organizationId: string, personnel: PersonSpec[], skillIds: string[]) {
    const assessors = personnel.filter((p) => p.isAssessor);
    const assessees = personnel.filter((p) => !p.isAssessor);

    async function createSession(opts: {
        name: string;
        sessionNumber: number;
        when: Date;
        fillRatio: number;
    }) {
        const sessionId = SkillCheckSessionId.create();
        await prisma.skillCheckSession.create({
            data: {
                id: sessionId,
                organizationId,
                name: opts.name,
                sessionNumber: opts.sessionNumber,
                status: "Include",
                startsAt: opts.when,
                endsAt: opts.fillRatio >= 1 ? opts.when : null,
                // Nullable in the DB, but the app's Zod schema requires a string.
                notes: "",
                assessees: { connect: assessees.map((p) => ({ id: p.id })) },
                assessors: { connect: assessors.map((p) => ({ id: p.id })) },
                skills: { connect: skillIds.map((id) => ({ id })) },
            },
        });

        const checks: Prisma.SkillCheckCreateManyInput[] = [];
        for (const assessee of assessees) {
            for (const skillId of skillIds) {
                if (rng() > opts.fillRatio) continue;
                checks.push({
                    id: SkillCheckId.create(),
                    organizationId,
                    sessionId,
                    assesseeId: assessee.id,
                    assessorId: assessors[Math.floor(rng() * assessors.length)].id,
                    skillId,
                    result: pickWeighted(
                        RESULT_WEIGHTS,
                    ) as Prisma.SkillCheckCreateManyInput["result"],
                    notes: "",
                    status: "Include",
                    createdAt: opts.when,
                });
            }
        }
        await prisma.skillCheck.createMany({ data: checks });
        console.log(`  session "${opts.name}" — ${checks.length} checks`);
    }

    // Historical: 14 months back, complete grid — 12-month skills have since lapsed.
    await createSession({
        name: "Autumn Rope Assessment",
        sessionNumber: 1,
        when: monthsAgo(14),
        fillRatio: 1,
    });
    // In progress: today, partially filled — the hero screenshot.
    await createSession({
        name: "Rope Assessment Day",
        sessionNumber: 2,
        when: new Date(),
        fillRatio: 0.6,
    });
}

async function main() {
    assertSafeTarget();
    console.log("Wiping any previous demo data…");
    await wipe();

    console.log("Building demo org…");
    const organizationId = await createOrg();

    const personnel = buildPersonnel();
    await createPeopleAndTeams(organizationId, personnel);
    await createUsers(organizationId, personnel[0].id, personnel[1].id);

    const skillIds = await createSkillPackage(organizationId);
    await createSessions(organizationId, personnel, skillIds);

    console.log("\nDone. Sign in at /auth/sign-in as one of the demo logins above.");
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
        console.error(err);
        await prisma.$disconnect();
        process.exit(1);
    });
