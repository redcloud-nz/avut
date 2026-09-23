/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { organization } from "better-auth/plugins";
import { getTestInstance } from "better-auth/test";
import { describe, expect, it, vi } from "vitest";

import { revalidateRolesAfterLeave } from "./organization-user-hooks";

// Runs against a real Better Auth instance rather than a stubbed context: the point is that the
// hook fires for `/organization/leave`, which none of the `organizationHooks` do.
describe("revalidateRolesAfterLeave", () => {
    async function setup() {
        const revalidate = vi.fn(async (_userId: string) => {});
        const { auth, signInWithTestUser } = await getTestInstance({
            plugins: [organization()],
            hooks: { after: revalidateRolesAfterLeave(revalidate) },
        });
        const { headers, user } = await signInWithTestUser();

        const org = await auth.api.createOrganization({
            headers,
            body: { name: "Acme", slug: "acme" },
        });

        return { auth, headers, org, revalidate, user };
    }

    it("drops the leaving user's cached roles", async () => {
        const { auth, headers, org, revalidate, user } = await setup();

        // Someone else must hold the owner role, or Better Auth refuses to let the owner leave.
        const other = await auth.api.signUpEmail({
            body: { name: "Other", email: "other@test.com", password: "test123456" },
        });
        await auth.api.addMember({
            body: { userId: other.user.id, role: "owner", organizationId: org.id },
        });
        revalidate.mockClear();

        await auth.api.leaveOrganization({ headers, body: { organizationId: org.id } });

        expect(revalidate).toHaveBeenCalledTimes(1);
        expect(revalidate).toHaveBeenCalledWith(user.id);
    });

    it("leaves the cache alone for unrelated organization endpoints", async () => {
        const { auth, headers, revalidate } = await setup();
        revalidate.mockClear();

        await auth.api.listOrganizations({ headers });

        expect(revalidate).not.toHaveBeenCalled();
    });
});
