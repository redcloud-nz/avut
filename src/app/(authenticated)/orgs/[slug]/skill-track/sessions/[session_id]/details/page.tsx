/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/details
 */

"use client";

import { use, useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { SkillsModule_SessionMenu } from "../session-menu";
import { SkillsModule_UpdateSession_Dialog } from "../update-session";

export default function SkillTrack_SessionDetails_Page(
    props: PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/details">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();

    const { data: session } = useSuspenseQuery(
        trpc.skills.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId: session_id,
        }),
    );

    const [updateSessionDialogOpen, setUpdateSessionDialogOpen] = useState(false);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                    {
                        label: "Sessions",
                        href: route("/orgs/[slug]/skill-track/sessions", { slug }),
                    },
                    {
                        label: session.name || session.id,
                        href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                            slug,
                            session_id,
                        }),
                    },
                    "Details",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Session Details</Saratoga.Title>
                        <Saratoga.Actions>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setUpdateSessionDialogOpen(true)}
                            >
                                <ObjectIcons.Edit />
                            </Button>
                            <SkillsModule_SessionMenu session={session} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Session Details</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Session ID</DLTerm>
                                        <DLDetails>{session.id}</DLDetails>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{session.name}</DLDetails>
                                        <DLTerm>Date</DLTerm>
                                        <DLDetails>{session.date}</DLDetails>
                                        <DLTerm>Notes</DLTerm>
                                        <DLDetails>{session.notes}</DLDetails>
                                        <DLTerm>Status</DLTerm>
                                        <DLDetails>{session.status}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(session.createdAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(session.createdAt)}
                                            </div>
                                        </DLDetails>
                                        <DLTerm>Updated</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(session.updatedAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(session.updatedAt)}
                                            </div>
                                        </DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
            <SkillsModule_UpdateSession_Dialog
                session={session}
                open={updateSessionDialogOpen}
                onOpenChange={setUpdateSessionDialogOpen}
            />
        </Std.SidebarInset>
    );
}
