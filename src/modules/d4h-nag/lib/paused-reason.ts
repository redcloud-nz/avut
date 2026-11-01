/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { D4HNagPausedReason } from "@/lib/schemas/d4h-nag";

interface PausedReasonText {
    /** A few words, for a table cell or a badge. */
    label: string;
    /** A sentence saying what's wrong and where to fix it. */
    description: string;
}

const PAUSED_REASONS: Record<D4HNagPausedReason, PausedReasonText> = {
    "d4h-disabled": {
        label: "D4H integration off",
        description:
            "The organisation's D4H integration is turned off. Turn it on in the organisation settings.",
    },
    disabled: {
        label: "Disabled",
        description: "This rule is turned off. Enable it to send reminders again.",
    },
    "team-inactive": {
        label: "Team not active",
        description: "The rule's team is archived or deleted. Restore the team to send reminders.",
    },
    "team-unlinked": {
        label: "Team not linked to D4H",
        description: "The rule's team isn't linked to a D4H team. Link it from the team's page.",
    },
    "no-token": {
        label: "No D4H token",
        description:
            "The module has no D4H access token to use. Choose one in the module's settings.",
    },
    "token-cannot-see-team": {
        label: "Token can't see team",
        description:
            "The module's D4H access token can't see this team's D4H team. Choose a token that can in the module's settings.",
    },
};

/** Why a rule is paused, in words. Shared by the rules list and the rule page. */
export function describePausedReason(reason: D4HNagPausedReason): PausedReasonText {
    return PAUSED_REASONS[reason];
}
