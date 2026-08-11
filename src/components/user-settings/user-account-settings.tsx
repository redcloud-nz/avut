/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { authClient } from "@/client/auth-client";
import { Alert } from "@/components/ui/alert";
import { RainbowSpinner } from "@/components/ui/loading";
import { UserEmail_Card } from "@/components/user-settings/user-email-card";
import { UserProfile_Card } from "@/components/user-settings/user-profile-card";

export function UserAccountSettings() {
    const sessionQuery = authClient.useSession();

    if (sessionQuery.isPending) {
        return <RainbowSpinner className="mx-auto" />;
    }

    if (!sessionQuery.data) {
        return <Alert variant="error">No user data available</Alert>;
    }

    return (
        <div className="space-y-4">
            <UserProfile_Card session={sessionQuery.data} />
            <UserEmail_Card session={sessionQuery.data} refetchSession={sessionQuery.refetch} />
        </div>
    );
}
