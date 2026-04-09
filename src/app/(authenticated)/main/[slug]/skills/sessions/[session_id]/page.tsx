/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]
 */

"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import type { Route } from "next";

import { trpc } from "@/trpc/client";

export default function SkillsModule_Session_Page(
    props: PageProps<"/main/[slug]/skills/sessions/[session_id]">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();

    const { data: sessions } = useSuspenseQuery(
        trpc.skills.listSessions.queryOptions({ organizationId: organization.id }),
    );

    const session = sessions.find((s) => s.id === session_id);
    if (!session) throw new Error(`Session(${session_id}) not found`);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Sessions", href: route("/main/[slug]/skills/sessions", { slug }) },
                    session.name || session.id,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/skills/sessions", { slug })}
                            tooltip="Back to sessions list"
                        />
                        <Hermes.Title>{session.name}</Hermes.Title>
                        <Hermes.Action>
                            <Button asChild>
                                <Link
                                    href={
                                        `/main/${slug}/skills/sessions/${session_id}/record` as Route
                                    }
                                >
                                    Recorder
                                </Link>
                            </Button>
                        </Hermes.Action>
                    </Hermes.Header>

                    <Card>
                        <CardHeader>
                            <CardTitle>Session details</CardTitle>
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
                                    <FieldLabel>Created At</FieldLabel>
                                    <FieldValue value={session.createdAt} format="datetime" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Updated At</FieldLabel>
                                    <FieldValue value={session.updatedAt} format="datetime" />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
