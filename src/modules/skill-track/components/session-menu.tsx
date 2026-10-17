/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { LockOpenIcon } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";

import { ObjectIcons, SessionReviewIcon } from "@/components/icons";
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";

import { SkillsModule_DeleteSession_Dialog } from "./delete-session";
import { SkillsModule_ReopenSession_Dialog } from "./reopen-session";

export function SkillsModule_SessionMenu({ session }: { session: SkillCheckSession }) {
    const organization = useOrganization();
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update", "reopen", "delete"] as const),
    );

    const canUpdate = useHasPermission({ skillCheckSession: ["update"] });
    const canReopen = useHasPermission({ skillCheckSession: ["approve"] });
    const canDelete = useHasPermission({ skillCheckSession: ["delete"] });

    // Reopen only exists for an approved session; a Draft one has nothing to reopen.
    const isApproved = session.status === "Include";

    // The edit dialog isn't mounted for an approved session, so it can't clear its own param. A
    // stale `?action=update` (a shared link, or one left by approving with the dialog open) would
    // otherwise open it as soon as the session is reopened. Replaces the history entry.
    useEffect(() => {
        if (isApproved && action === "update") void setAction(null, { history: "replace" });
    }, [isApproved, action, setAction]);

    const actions: MenuActionProps[] = [
        // Approving locks the whole session, so Edit is off until it's reopened, as Record is.
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => setAction("update", { history: "push" }),
            disabled: !canUpdate || isApproved,
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
                width="w-40"
                before={
                    <>
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <Link
                                    href={route(
                                        "/orgs/[slug]/skill-track/sessions/[session_id]/history",
                                        {
                                            slug: organization.slug,
                                            session_id: session.id,
                                        },
                                    )}
                                >
                                    <ObjectIcons.History /> History
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link
                                    href={route(
                                        "/orgs/[slug]/skill-track/sessions/[session_id]/review",
                                        {
                                            slug: organization.slug,
                                            session_id: session.id,
                                        },
                                    )}
                                >
                                    <SessionReviewIcon /> Review
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
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
