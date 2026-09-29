/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { SkillTrack_ChangeSessionPersonnel_Dialog } from "@/components/skill-track/change-session-personnel";
import { SkillTrack_ChangeSessionSkills_Dialog } from "@/components/skill-track/change-session-skills";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";

const SESSION_CONFIG_ACTIONS = ["change-personnel", "change-skills", "change-assessors"] as const;

export type SessionConfigAction = (typeof SESSION_CONFIG_ACTIONS)[number];

/**
 * The `?action=` param for the session config dialogs. `open(...)` pushes a history entry (so
 * Back closes the dialog), `close()` replaces it (so Back from the closed page doesn't reopen it).
 * Triggers call `open(...)`; `SkillTrack_SessionConfigDialogs` renders the dialogs themselves.
 */
export function useSessionConfigAction() {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(SESSION_CONFIG_ACTIONS),
    );

    return {
        action,
        open: (next: SessionConfigAction) => void setAction(next, { history: "push" }),
        close: () => void setAction(null, { history: "replace" }),
    };
}

/**
 * Hosts the dialogs that change a skill check session's personnel, skills and assessors, driven
 * by `?action=change-personnel` / `change-skills` / `change-assessors`. Mount it once per page
 * that can open them.
 */
export function SkillTrack_SessionConfigDialogs({ sessionId }: { sessionId: SkillCheckSessionId }) {
    const { action, open, close } = useSessionConfigAction();

    function dialogProps(dialogAction: SessionConfigAction) {
        return {
            open: action === dialogAction,
            onOpenChange: (isOpen: boolean) => (isOpen ? open(dialogAction) : close()),
        };
    }

    return (
        <>
            <SkillTrack_ChangeSessionPersonnel_Dialog
                sessionId={sessionId}
                {...dialogProps("change-personnel")}
            />
            <SkillTrack_ChangeSessionSkills_Dialog
                sessionId={sessionId}
                {...dialogProps("change-skills")}
            />
            {/* change-assessors: added with the assessors dialog. */}
        </>
    );
}
