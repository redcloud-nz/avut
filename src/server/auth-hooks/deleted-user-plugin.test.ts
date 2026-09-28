/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { organization } from "better-auth/plugins";
import { getTestInstance } from "better-auth/test";
import { describe, expect, it } from "vitest";

import { deletedUserPlugin } from "./deleted-user-plugin";

// Against a real Better Auth instance: the point is that the hooks fire on the real sign-in and
// list-members paths, not that a stubbed context calls them.
describe("deletedUserPlugin", () => {
    async function setup() {
        const deleted = new Set<string>();
        const { auth, signInWithTestUser } = await getTestInstance({
            plugins: [organization(), deletedUserPlugin(async () => deleted)],
        });
        return { auth, deleted, signInWithTestUser };
    }

    it("lets a closed account sign in — the app gate sends it to /auth/account-closed", async () => {
        const { auth, deleted } = await setup();
        const { user } = await auth.api.signUpEmail({
            body: { name: "Gone", email: "gone@test.com", password: "test123456" },
        });
        deleted.add(user.id);

        const result = await auth.api.signInEmail({
            body: { email: "gone@test.com", password: "test123456" },
        });
        expect(result.token).toBeTruthy();
    });

    it("refuses Better Auth's organization endpoints to a closed account", async () => {
        const { auth, deleted, signInWithTestUser } = await setup();
        const { headers, user } = await signInWithTestUser();
        deleted.add(user.id);

        await expect(
            auth.api.createOrganization({ headers, body: { name: "Nope", slug: "nope" } }),
        ).rejects.toMatchObject({ body: { code: "ACCOUNT_CLOSED" } });
    });

    it("leaves an open account's organization endpoints alone", async () => {
        const { auth, signInWithTestUser } = await setup();
        const { headers } = await signInWithTestUser();

        const org = await auth.api.createOrganization({
            headers,
            body: { name: "Fine", slug: "fine" },
        });
        expect(org?.slug).toBe("fine");
    });

    it("leaves a deleted account's membership out of list-members", async () => {
        const { auth, deleted, signInWithTestUser } = await setup();
        const { headers, user } = await signInWithTestUser();
        const org = await auth.api.createOrganization({
            headers,
            body: { name: "Acme", slug: "acme" },
        });
        const other = await auth.api.signUpEmail({
            body: { name: "Other", email: "other@test.com", password: "test123456" },
        });
        await auth.api.addMember({
            body: { userId: other.user.id, role: "member", organizationId: org.id },
        });
        deleted.add(other.user.id);

        const { members, total } = await auth.api.listMembers({
            headers,
            query: { organizationId: org.id },
        });
        expect(members.map((m) => m.userId)).toEqual([user.id]);
        expect(total).toBe(1);
    });
});
