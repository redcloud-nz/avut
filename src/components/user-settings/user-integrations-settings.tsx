/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { D4HAccessTokens_Card } from "@/components/user-settings/d4h-access-tokens-card";

export function UserIntegrationsSettings() {
    return (
        <div className="space-y-4">
            <D4HAccessTokens_Card />
        </div>
    );
}
