/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/account-closed
 *
 * Where a closed (soft-deleted, #296) account lands after signing in — `requireSession` sends it
 * here from every authenticated route. Its owner can restore it if they closed it themselves.
 */

import { redirect } from "next/navigation";

import { AccountClosed_Content } from "@/components/auth/account-closed-content";
import { Argus } from "@/components/blocks/argus";
import { isAccountClosed, requireSessionAllowingClosed } from "@/server/session";
import { fetchQuery, trpc } from "@/trpc/server";

export const metadata = { title: "Account Closed" };

export default async function AccountClosed_Page() {
    const session = await requireSessionAllowingClosed();
    if (!isAccountClosed(session)) redirect("/user");

    const closure = await fetchQuery(trpc.user.getAccountClosure.queryOptions());

    return (
        <Argus.Root fullHeight={false}>
            <Argus.Column>
                <AccountClosed_Content
                    email={session.user.email}
                    canRestore={closure.canRestore}
                    purgeAt={closure.purgeAt}
                />
            </Argus.Column>
        </Argus.Root>
    );
}
