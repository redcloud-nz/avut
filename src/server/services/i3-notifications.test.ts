/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { fetchD4HMember, type D4HMemberWithOptionalEmail } from "@/server/d4h-api/client";
import { sendEmail } from "@/server/email";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as I3Notifications from "./i3-notifications";
import * as OrgSettings from "./organization-settings";

vi.mock("@/server/d4h-api/client", () => ({
    fetchD4HMember: vi.fn(),
}));

vi.mock("@/server/email", () => ({
    sendEmail: vi.fn(async () => {}),
}));

describe("I3Notifications.resolveNotifyRecipients", () => {
    const D4H_TEAM = 501;
    const D4H_TEAM_WITHOUT_AVUT_TEAM = 502;

    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        teamA: TeamId.create(),
        deletedTeam: TeamId.create(),
        otherOrgTeam: TeamId.create(),
        alice: PersonId.create(),
        bob: PersonId.create(),
        carol: PersonId.create(),
        archived: PersonId.create(),
        noEmail: PersonId.create(),
        otherOrgPerson: PersonId.create(),
        unknown: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        const teams = [
            { id: T.teamA, organizationId: T.org, status: "Active" as const },
            { id: T.deletedTeam, organizationId: T.org, status: "Deleted" as const },
            { id: T.otherOrgTeam, organizationId: T.otherOrg, status: "Active" as const },
        ];
        for (const team of teams) {
            await db.team.create({
                data: {
                    ...team,
                    name: team.id,
                    d4h: {
                        create: {
                            d4hTeamId: D4H_TEAM,
                            d4hTeamName: "Rescue Team A",
                            d4hServerCode: "ap",
                        },
                    },
                },
            });
        }

        const people = [
            { id: T.alice, name: "Alice", email: "alice@example.com" },
            // Padded, to check the address comes back trimmed.
            { id: T.bob, name: "Bob", email: " bob@example.com " },
            { id: T.carol, name: "Carol", email: "carol@example.com" },
            {
                id: T.archived,
                name: "Archie",
                email: "archie@example.com",
                status: "Archived" as const,
            },
            { id: T.noEmail, name: "Nemo", email: "  " },
        ];
        for (const person of people) {
            await db.person.create({ data: { ...person, organizationId: T.org } });
        }
        await db.person.create({
            data: {
                id: T.otherOrgPerson,
                organizationId: T.otherOrg,
                name: "Olive",
                email: "olive@example.com",
            },
        });
    });

    const ctx = () =>
        createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user },
            permissions: {},
            prisma: db,
        });

    async function setNotify(notify: OrganizationSettings["modules"]["d4h-i3"]["notify"]) {
        const current = await OrgSettings.read(db, T.org);
        await OrgSettings.write(db, T.org, {
            ...current,
            modules: {
                ...current.modules,
                "d4h-i3": { ...current.modules["d4h-i3"], notify },
            },
        });
    }

    async function resolve(d4hTeamId = D4H_TEAM) {
        const recipients = await I3Notifications.resolveNotifyRecipients(ctx(), { d4hTeamId });
        return recipients.map((r) => r.personId);
    }

    it("returns nobody for empty settings", async () => {
        await setNotify({ org: [], teams: {} });

        expect(await resolve()).toEqual([]);
    });

    it("returns the org list only", async () => {
        await setNotify({ org: [T.alice, T.bob], teams: {} });

        expect(
            await I3Notifications.resolveNotifyRecipients(ctx(), { d4hTeamId: D4H_TEAM }),
        ).toEqual([
            { personId: T.alice, name: "Alice", email: "alice@example.com" },
            { personId: T.bob, name: "Bob", email: "bob@example.com" },
        ]);
    });

    it("returns the team list only", async () => {
        await setNotify({ org: [], teams: { [T.teamA]: [T.carol] } });

        expect(await resolve()).toEqual([T.carol]);
    });

    it("returns the union of the org and team lists, deduped", async () => {
        await setNotify({ org: [T.alice, T.bob], teams: { [T.teamA]: [T.bob, T.carol] } });

        expect(await resolve()).toEqual([T.alice, T.bob, T.carol]);
    });

    it("drops archived people, unknown ids and people with no email", async () => {
        await setNotify({
            org: [T.alice, T.archived, T.unknown],
            teams: { [T.teamA]: [T.noEmail] },
        });

        expect(await resolve()).toEqual([T.alice]);
    });

    it("ignores a deleted team's list", async () => {
        await setNotify({ org: [], teams: { [T.deletedTeam]: [T.alice] } });

        expect(await resolve()).toEqual([]);
    });

    it("uses the org list only for a D4H team with no AVUT team", async () => {
        await setNotify({ org: [T.alice], teams: { [T.teamA]: [T.bob] } });

        expect(await resolve(D4H_TEAM_WITHOUT_AVUT_TEAM)).toEqual([T.alice]);
    });

    it("ignores a team and people in another org", async () => {
        await setNotify({
            org: [T.otherOrgPerson],
            teams: { [T.otherOrgTeam]: [T.alice] },
        });

        expect(await resolve()).toEqual([]);
    });
});

describe("I3Notifications.fetchReceiptAddress", () => {
    const token = { id: "token" } as unknown as D4HAccessToken_ServerOnly;
    const args = { d4hTeamId: 501, memberId: 42 };

    function member(email: D4HMemberWithOptionalEmail["email"]) {
        return { id: 42, name: "Dana", email } as D4HMemberWithOptionalEmail;
    }

    beforeEach(() => {
        vi.mocked(fetchD4HMember).mockReset();
    });

    it("returns the member's email, trimmed", async () => {
        vi.mocked(fetchD4HMember).mockResolvedValue(
            member({ value: "  dana@example.com ", verified: true }),
        );

        expect(await I3Notifications.fetchReceiptAddress(token, args)).toBe("dana@example.com");
        expect(fetchD4HMember).toHaveBeenCalledWith(token, 501, 42);
    });

    it.each([
        ["an empty email", { value: "", verified: false }],
        ["a whitespace email", { value: "   ", verified: false }],
        ["no email", null],
    ])("returns null for %s", async (_label, email) => {
        vi.mocked(fetchD4HMember).mockResolvedValue(member(email));

        expect(await I3Notifications.fetchReceiptAddress(token, args)).toBeNull();
    });

    it("returns null for a missing member", async () => {
        vi.mocked(fetchD4HMember).mockResolvedValue(null);

        expect(await I3Notifications.fetchReceiptAddress(token, args)).toBeNull();
    });

    it("lets a fetch error propagate", async () => {
        vi.mocked(fetchD4HMember).mockRejectedValue(new Error("D4H is down"));

        await expect(I3Notifications.fetchReceiptAddress(token, args)).rejects.toThrow(
            "D4H is down",
        );
    });
});

describe("I3Notifications.sendEach", () => {
    it("sends one email per recipient, in order", async () => {
        vi.mocked(sendEmail).mockClear();

        await I3Notifications.sendEach(["a@example.com", "b@example.com"], (to) => ({
            from: "no-reply@example.test",
            to,
            subject: "Hello",
            text: "Hi",
        }));

        expect(vi.mocked(sendEmail).mock.calls.map(([payload]) => payload.to)).toEqual([
            "a@example.com",
            "b@example.com",
        ]);
    });
});
