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
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";

import { SkillsModule_DeleteSession_Dialog } from "./delete-session";
import { SkillsModule_ReopenSession_Dialog } from "./reopen-session";

/** Every `?action=` the session page's dialogs answer to. Edit's dialog owns `update` itself. */
const sessionActions = parseAsStringLiteral(["update", "reopen", "delete"] as const);

/**
 * The Session card's ⋮ (the page's primary record card): Delete. Edit is the card's pencil,
 * History its "Updated" footer; Record, Reopen and Review are in
 * {@link SkillsModule_Session_ActionCards}.
 *
 * Mounts the Reopen and Delete dialogs, whichever card or button opens them.
 */
export function SkillsModule_SessionMenu({ session }: { session: SkillCheckSession }) {
    const [action, setAction] = useQueryState("action", sessionActions);

    const canDelete = useHasPermission({ skillCheckSession: ["delete"] });

    const isApproved = session.status === "Include";

    // The edit dialog isn't mounted for an approved session, so it can't clear its own param. A
    // stale `?action=update` (a shared link, or one left by approving with the dialog open) would
    // otherwise open it as soon as the session is reopened. Replaces the history entry.
    useEffect(() => {
        if (isApproved && action === "update") void setAction(null, { history: "replace" });
    }, [isApproved, action, setAction]);

    // Reopen's button is gone once it succeeds, so its dialog returns focus here instead.
    const triggerRef = useRef<HTMLButtonElement>(null);

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
 *   {@link SkillsModule_SessionMenu}).
 * - **Review** links to the review page, for every viewer.
 */
export function SkillsModule_Session_ActionCards({ session }: { session: SkillCheckSession }) {
    const organization = useOrganization();
    const [, setAction] = useQueryState("action", sessionActions);

    const canRecord = useHasPermission({ skillCheck: ["create"] });
    const canReopen = useHasPermission({ skillCheckSession: ["approve"] });

    const isApproved = session.status === "Include";
    const params = { slug: organization.slug, session_id: session.id };

    return (
        <>
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
                            href={route(
                                "/orgs/[slug]/skill-track/sessions/[session_id]/by-person",
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
                            href={route(
                                "/orgs/[slug]/skill-track/sessions/[session_id]/by-skill",
                                params,
                            )}
                        >
                            <ListChecksIcon /> Record by skill
                        </Link>
                    </Button>
                ) : null}
            </ActionsCard>
            <ActionsCard
                title="Review"
                description="Check coverage and resolve conflicting checks before approving the session."
            >
                <Button variant="outline" asChild>
                    <Link
                        href={route(
                            "/orgs/[slug]/skill-track/sessions/[session_id]/review",
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
