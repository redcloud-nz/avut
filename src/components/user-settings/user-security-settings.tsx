/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useQuery } from "@tanstack/react-query";

import { linkedAccountsQueryOptions } from "@/client/auth-queries";
import { Alert } from "@/components/ui/alert";
import { RainbowSpinner } from "@/components/ui/loading";
import { ActiveSessions_Card } from "@/components/user-settings/active-sessions-card";
import { LinkedAccounts_Card } from "@/components/user-settings/linked-accounts-card";
import { UserPassword_Card } from "@/components/user-settings/user-password-card";

export function UserSecuritySettings() {
    // Shares a cache entry with `LinkedAccounts_Card`, which reads the same query — one
    // request serves both. Needed here only to decide between the set/change password card.
    const accountsQuery = useQuery(linkedAccountsQueryOptions());

    if (accountsQuery.isPending) {
        return (
            <div className="p-4">
                <RainbowSpinner className="mx-auto" />
            </div>
        );
    }
    if (accountsQuery.isError) {
        return (
            <Alert variant="error">
                Failed to load linked accounts: {accountsQuery.error.message}
            </Alert>
        );
    }

    const hasCredentialAccount = accountsQuery.data.some(
        (account) => account.providerId === "credential",
    );

    return (
        <div className="space-y-4">
            <UserPassword_Card hasCredentialAccount={hasCredentialAccount} />
            <LinkedAccounts_Card />
            <ActiveSessions_Card />
        </div>
    );
}
