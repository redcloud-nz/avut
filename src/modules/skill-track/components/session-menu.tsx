/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ListChecksIcon, LockOpenIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useRef } from "react";

import { ObjectIcons, SessionReviewIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { ActionsCard, RecordCardMenu } from "@/components/ui/record-card-actions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useScopedRoute } from "@/hooks/use-scoped-route";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { useSessionAccess } from "@/modules/skill-track/lib/use-session-access";

import { SkillsModule_DeleteSession_Dialog } from "./delete-session";
import { SkillsModule_ReopenSession_Dialog } from "./reopen-session";

/** Every `?action=` the session page's dialogs answer to. Edit's dialog owns `update` itself. */
const sessionActions = parseAsStringLiteral(["update", "reopen", "delete"] as const);

/**
 * The Session card's ⋮ (the page's primary record card): Delete. Edit is the card's pencil,
 * History its "Updated" footer; Record, Reopen and Review are in
 * {@link SkillsModule_Session_ActionCards}.
 *
 * Mounts the Reopen and Delete dialogs, whichever card or button opens them. A foreign session
 * (another team's, or an org one, in team scope) is view only here: no ⋮ and no dialogs (nor
 * their hotkeys), though a stale `?action=` is still cleared.
 */
export function SkillsModule_SessionMenu({ session }: { session: SkillCheckSession }) {
    const [action, setAction] = useQueryState("action", sessionActions);

    const canDelete = useHasPermission({ skillCheckSession: ["delete"] });

    // Reopen only exists for an approved session; a Draft one has nothing to reopen.
    const isApproved = session.status === "Include";
    const { foreign, locked } = useSessionAccess(session);

    // The edit dialog isn't mounted for a locked session, so it can't clear its own param, and
    // a foreign session's Reopen and Delete dialogs never open. A stale `?action=` (a shared or
    // pasted link, or one left by approving with the dialog open) would otherwise open its dialog
    // as soon as the session is reopened (or, for a foreign one, is opened in its own scope).
    // Replaces the history entry.
    const staleAction = foreign ? action : locked && action === "update" ? action : null;
    useEffect(() => {
        if (staleAction) void setAction(null, { history: "replace" });
    }, [staleAction, setAction]);

    // Reopen's button is gone once it succeeds, so its dialog returns focus here instead.
    const triggerRef = useRef<HTMLButtonElement>(null);

    if (foreign) return null;

    const actions: MenuActionProps[] = [];
    if (canDelete) {
        actions.push({
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            destructive: true,
        });
    }

    return (
        <>
            <RecordCardMenu actions={actions} category="Sessions" primary triggerRef={triggerRef} />

            <SkillsModule_ReopenSession_Dialog
                session={session}
                returnFocusRef={triggerRef}
                open={isApproved && action === "reopen"}
                onOpenChange={(open) =>
                    setAction(open ? "reopen" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillsModule_DeleteSession_Dialog
                session={session}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}

/**
 * The session's action cards, at the top of its secondary column, one per job:
 *
 * - **Record** opens the two recording views. While the session is approved its checks are
 *   locked, so the card offers Reopen instead (the Reopen dialog is in
 *   {@link SkillsModule_SessionMenu}). Not shown for a foreign session, which is view only here.
 * - **Review** links to the review page, for every viewer.
 */
export function SkillsModule_Session_ActionCards({ session }: { session: SkillCheckSession }) {
    const scopedRoute = useScopedRoute();
    const [, setAction] = useQueryState("action", sessionActions);

    const canRecord = useHasPermission({ skillCheck: ["create"] });
    const canReopen = useHasPermission({ skillCheckSession: ["approve"] });

    const isApproved = session.status === "Include";
    const { foreign } = useSessionAccess(session);
    const params = { session_id: session.id };

    return (
        <>
            {!foreign && (
                <ActionsCard
                    title="Record"
                    description={
                        isApproved
                            ? "Checks are locked while the session is approved. Reopen it to record or change them."
                            : "Record checks one person at a time, or one skill across everyone."
                    }
                >
                    {isApproved && canReopen ? (
                        <Button onClick={() => setAction("reopen", { history: "push" })}>
                            <LockOpenIcon /> Reopen
                        </Button>
                    ) : null}
                    {!isApproved && canRecord ? (
                        <Button variant="outline" asChild>
                            <Link
                                href={scopedRoute(
                                    {
                                        organization:
                                            "/orgs/[slug]/skill-track/sessions/[session_id]/by-person",
                                        team: "/teams/[slug]/skill-track/sessions/[session_id]/by-person",
                                    },
                                    params,
                                )}
                            >
                                <UserIcon /> Record by person
                            </Link>
                        </Button>
                    ) : null}
                    {!isApproved && canRecord ? (
                        <Button variant="outline" asChild>
                            <Link
                                href={scopedRoute(
                                    {
                                        organization:
                                            "/orgs/[slug]/skill-track/sessions/[session_id]/by-skill",
                                        team: "/teams/[slug]/skill-track/sessions/[session_id]/by-skill",
                                    },
                                    params,
                                )}
                            >
                                <ListChecksIcon /> Record by skill
                            </Link>
                        </Button>
                    ) : null}
                </ActionsCard>
            )}
            <ActionsCard
                title="Review"
                description="Check coverage and resolve conflicting checks before approving the session."
            >
                <Button variant="outline" asChild>
                    <Link
                        href={scopedRoute(
                            {
                                organization:
                                    "/orgs/[slug]/skill-track/sessions/[session_id]/review",
                                team: "/teams/[slug]/skill-track/sessions/[session_id]/review",
                            },
                            params,
                        )}
                    >
                        <SessionReviewIcon /> Review
                    </Link>
                </Button>
            </ActionsCard>
        </>
    );
}
