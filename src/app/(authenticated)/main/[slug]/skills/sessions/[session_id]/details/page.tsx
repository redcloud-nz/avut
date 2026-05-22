/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]/details
 */

"use client";

import { use, useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { SkillsModule_SessionMenu } from "../session-menu";
import { SkillsModule_UpdateSession_Dialog } from "../update-session";

export default function SkillsModule_SessionDetails_Page(
    props: PageProps<"/main/[slug]/skills/sessions/[session_id]/details">,
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
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Sessions", href: route("/main/[slug]/skills/sessions", { slug }) },
                    {
                        label: session.name || session.id,
                        href: route("/main/[slug]/skills/sessions/[session_id]", {
                            slug,
                            session_id,
                        }),
                    },
                    "Details",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/skills/sessions/[session_id]", {
                                slug,
                                session_id,
                            })}
                            tooltip="Back to session"
                        />
                        <Hermes.Title>Session Details</Hermes.Title>
                    </Hermes.Header>

                    <Card>
                        <CardHeader>
                            <CardTitle>Session Details</CardTitle>
                            <CardAction>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setUpdateSessionDialogOpen(true)}
                                >
                                    <ObjectIcons.Edit />
                                </Button>
                                <SkillsModule_SessionMenu session={session} />
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Session ID</FieldLabel>
                                    <FieldValue value={session.id} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Name</FieldLabel>
                                    <FieldValue value={session.name} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Date</FieldLabel>
                                    <FieldValue value={session.date} format="date" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Notes</FieldLabel>
                                    <FieldValue value={session.notes} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Status</FieldLabel>
                                    <FieldValue value={session.status} />
                                </Field>
                                <FieldSeparator />

                                <Field orientation="responsive">
                                    <FieldLabel>Created</FieldLabel>
                                    <FieldValue
                                        value={session.createdAt}
                                        format="dateTimeWithDistance"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Updated</FieldLabel>
                                    <FieldValue
                                        value={session.updatedAt}
                                        format="dateTimeWithDistance"
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                </Lexington.Column>
            </Lexington.Page>
            <SkillsModule_UpdateSession_Dialog
                session={session}
                open={updateSessionDialogOpen}
                onOpenChange={setUpdateSessionDialogOpen}
            />
        </Lexington.Root>
    );
}
