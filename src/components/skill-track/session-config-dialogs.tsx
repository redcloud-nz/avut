/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useQueryState } from "nuqs";
import { useEffect, type RefObject } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Protect } from "@/components/protect";
import { SkillTrack_ChangeSessionAssessors_Dialog } from "@/components/skill-track/change-session-assessors";
import { SkillTrack_ChangeSessionPersonnel_Dialog } from "@/components/skill-track/change-session-personnel";
import { SkillTrack_ChangeSessionSkills_Dialog } from "@/components/skill-track/change-session-skills";
import { useOrganization } from "@/hooks/use-organization";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

const SESSION_CONFIG_ACTIONS = ["change-personnel", "change-skills", "change-assessors"] as const;

export type SessionConfigAction = (typeof SESSION_CONFIG_ACTIONS)[number];

/**
 * The `?action=` param for the session config dialogs. `open(...)` pushes a history entry (so
 * Back closes the dialog), `close()` replaces it (so Back from the closed page doesn't reopen it).
 * `close(only)` clears the param only while it still names `only`, so a save that settles after
 * its dialog was dismissed can't close a different dialog opened in the meantime. The param is
 * read raw, not with `parseAsStringLiteral`: the page's other dialogs share `?action=` (e.g.
 * `update`, `delete`), and a literal parser would read theirs as `null`, which `close` would clear.
 * Triggers call `open(...)`; `SkillTrack_SessionConfigDialogs` renders the dialogs themselves.
 */
export function useSessionConfigAction() {
    const [rawAction, setAction] = useQueryState("action");
    const action = isSessionConfigAction(rawAction) ? rawAction : null;

    return {
        action,
        open: (next: SessionConfigAction) => void setAction(next, { history: "push" }),
        close: (only?: SessionConfigAction) =>
            void setAction((current) => (only && current !== only ? current : null), {
                history: "replace",
            }),
    };
}

function isSessionConfigAction(value: string | null): value is SessionConfigAction {
    return (SESSION_CONFIG_ACTIONS as readonly (string | null)[]).includes(value);
}

/**
 * Hosts the dialogs that change a skill check session's personnel, skills and assessors, driven
 * by `?action=change-personnel` / `change-skills` / `change-assessors`. Mount it once per page
 * that can open them.
 *
 * Each dialog returns focus on close to whatever was focused when it opened. Pass `returnFocusRef`
 * for triggers that unmount before their dialog closes (an item in a sheet or menu): when the
 * opener is gone, focus goes to that element instead.
 */
export function SkillTrack_SessionConfigDialogs({
    sessionId,
    returnFocusRef,
}: {
    sessionId: SkillCheckSessionId;
    returnFocusRef?: RefObject<HTMLElement | null>;
}) {
    const organization = useOrganization();
    const { action, open, close } = useSessionConfigAction();

    const { data: session } = useSuspenseQuery(
        trpc.skillCheckSessions.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
        }),
    );
    // An approved session's config is locked until it's reopened. The triggers are disabled
    // then; this covers a shared `?action=change-*` link, and a session approved while one is open:
    // the param is cleared (replacing the history entry), and `open` is masked until it is.
    const isApproved = session.status === "Include";

    useEffect(() => {
        if (isApproved && action) close(action);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `close` is rebuilt every render
    }, [isApproved, action]);

    function dialogProps(dialogAction: SessionConfigAction) {
        return {
            sessionId,
            returnFocusRef,
            open: !isApproved && action === dialogAction,
            onOpenChange: (isOpen: boolean) => (isOpen ? open(dialogAction) : close(dialogAction)),
        };
    }

    // The triggers are gated the same way; this covers a shared `?action=change-*` link.
    return (
        <Protect permissions={{ skillCheckSession: ["update"] }}>
            <SkillTrack_ChangeSessionPersonnel_Dialog {...dialogProps("change-personnel")} />
            <SkillTrack_ChangeSessionSkills_Dialog {...dialogProps("change-skills")} />
            <SkillTrack_ChangeSessionAssessors_Dialog {...dialogProps("change-assessors")} />
        </Protect>
    );
}
