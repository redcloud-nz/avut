/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useRef } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { OrgUserLink } from "@/components/entity-links/org-user-link";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { AdminModule_GrantTeamAccess_Dialog } from "./grant-team-access";
import { AdminModule_RevokeTeamAccess_Dialog } from "./revoke-team-access";

/**
 * The users granted access to a team (`TeamUser`), with grant and revoke. Owns the
 * `?action=grant-access` and `?action=revoke-access&userId=…` params for its dialogs.
 */
export function AdminModule_TeamAccess_Card({ team }: { team: TeamData }) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["grant-access", "revoke-access"] as const),
    );
    const [userId, setUserId] = useQueryState("userId", parseAsString);

    const { data: grants } = useSuspenseQuery(
        trpc.teamUsers.listTeamUsers.queryOptions({
            organizationId: organization.id,
            teamId: team.id,
        }),
    );

    const grantButtonRef = useRef<HTMLButtonElement>(null);
    const revokeGrant = grants.find((grant) => grant.userId === userId) ?? null;

    function openRevoke(id: string) {
        void setUserId(id, { history: "push" });
        void setAction("revoke-access", { history: "push" });
    }
    function closeRevoke() {
        void setAction(null, { history: "replace" });
        void setUserId(null, { history: "replace" });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Access</CardTitle>
                {team.status === "Active" && (
                    <CardAction>
                        <Protect permissions={{ member: ["update"] }}>
                            <Button
                                ref={grantButtonRef}
                                variant="ghost"
                                size="icon"
                                aria-label="Grant access"
                                onClick={() => setAction("grant-access", { history: "push" })}
                            >
                                <ObjectIcons.Create />
                            </Button>
                        </Protect>
                    </CardAction>
                )}
            </CardHeader>
            <CardContent>
                {grants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No one has access to this team yet.
                    </p>
                ) : (
                    <ItemGroup>
                        {grants.map((grant) => (
                            <Item key={grant.id} variant="outline" size="sm">
                                <ItemContent>
                                    <ItemTitle>
                                        <OrgUserLink user={grant.user} />
                                        {grant.onRoster && (
                                            <Badge variant="secondary">On roster</Badge>
                                        )}
                                    </ItemTitle>
                                    <ItemDescription>{grant.user.email}</ItemDescription>
                                </ItemContent>
                                <Protect permissions={{ member: ["update"] }}>
                                    <ItemActions>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Revoke access for ${grant.user.name}`}
                                            onClick={() => openRevoke(grant.userId)}
                                        >
                                            <ObjectIcons.Delete />
                                        </Button>
                                    </ItemActions>
                                </Protect>
                            </Item>
                        ))}
                    </ItemGroup>
                )}
            </CardContent>

            <AdminModule_GrantTeamAccess_Dialog
                team={team}
                returnFocusRef={grantButtonRef}
                open={action === "grant-access" && team.status === "Active"}
                onOpenChange={(open) =>
                    setAction(open ? "grant-access" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            {revokeGrant && (
                <AdminModule_RevokeTeamAccess_Dialog
                    team={team}
                    grant={revokeGrant}
                    returnFocusRef={grantButtonRef}
                    open={action === "revoke-access"}
                    onOpenChange={(open) => (open ? undefined : closeRevoke())}
                />
            )}
        </Card>
    );
}
