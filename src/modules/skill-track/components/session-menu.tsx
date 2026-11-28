/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { LockOpenIcon } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";

import { DropdownMenuTriggerIcon, ObjectIcons, SessionReviewIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useScopedRoute } from "@/hooks/use-scoped-route";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { useSessionAccess } from "@/modules/skill-track/lib/use-session-access";

import { SkillsModule_DeleteSession_Dialog } from "./delete-session";
import { SkillsModule_ReopenSession_Dialog } from "./reopen-session";

export function SkillsModule_SessionMenu({ session }: { session: SkillCheckSession }) {
    const scopedRoute = useScopedRoute();
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update", "reopen", "delete"] as const),
    );

    const canUpdate = useHasPermission({ skillCheckSession: ["update"] });
    const canReopen = useHasPermission({ skillCheckSession: ["approve"] });
    const canDelete = useHasPermission({ skillCheckSession: ["delete"] });

    // Reopen only exists for an approved session; a Draft one has nothing to reopen.
    const isApproved = session.status === "Include";
    // A foreign session (another team's, or an org one, in team scope) is view only here: no
    // Edit, Reopen or Delete at all.
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

    const links = (
        <DropdownMenuGroup>
            <DropdownMenuItem asChild>
                <Link
                    href={scopedRoute(
                        {
                            organization: "/orgs/[slug]/skill-track/sessions/[session_id]/history",
                            team: "/teams/[slug]/skill-track/sessions/[session_id]/history",
                        },
                        { session_id: session.id },
                    )}
                >
                    <ObjectIcons.History /> History
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link
                    href={scopedRoute(
                        {
                            organization: "/orgs/[slug]/skill-track/sessions/[session_id]/review",
                            team: "/teams/[slug]/skill-track/sessions/[session_id]/review",
                        },
                        { session_id: session.id },
                    )}
                >
                    <SessionReviewIcon /> Review
                </Link>
            </DropdownMenuItem>
        </DropdownMenuGroup>
    );

    // No actions and no dialogs (nor their hotkeys): only the links to the session's other pages.
    if (foreign) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Actions" className="glyph-halo">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">{links}</DropdownMenuContent>
            </DropdownMenu>
        );
    }

    const actions: MenuActionProps[] = [
        // Approving locks the whole session, so Edit is off until it's reopened, as Record is.
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => setAction("update", { history: "push" }),
            disabled: !canUpdate || locked,
        },
        ...(isApproved
            ? [
                  {
                      verb: "reopen",
                      label: "Reopen",
                      icon: <LockOpenIcon />,
                      onSelect: () => setAction("reopen", { history: "push" }),
                      disabled: !canReopen,
                  } satisfies MenuActionProps,
              ]
            : []),
        {
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            disabled: !canDelete,
            destructive: true,
        },
    ];

    return (
        <>
            <EntityActionMenu
                actions={actions}
                category="Sessions"
                before={
                    <>
                        {links}
                        <DropdownMenuSeparator />
                    </>
                }
            />

            <SkillsModule_ReopenSession_Dialog
                session={session}
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
