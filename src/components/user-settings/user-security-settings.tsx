/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { Alert } from "@/components/ui/alert";
import { RainbowSpinner } from "@/components/ui/loading";
// import { LinkedAccounts_Card } from "@/components/user-settings/linked-accounts-card";
import { UserPassword_Card } from "@/components/user-settings/user-password-card";

export function UserSecuritySettings() {
    const accountsQuery = useQuery({
        queryFn: () => authClient.listAccounts({}, { throw: true }),
        queryKey: ["user", "linkedAccounts"],
    });

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
        (account) => account.providerId === "credentials",
    );

    return (
        <div className="space-y-4">
            <UserPassword_Card hasCredentialAccount={hasCredentialAccount} />
            {/* <LinkedAccounts_Card
                linkedAccounts={accountsQuery.data.map((account) => account.providerId)}
            /> */}
        </div>
    );
}
