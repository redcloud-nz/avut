/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup } from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime } from "@/lib/datetime";
import * as Paths from "@/paths";
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { AdminModule_TeamMenu } from "./team-menu";

export default function AdminModule_Team_Page(
    props: PageProps<`/orgs/[slug]/admin/teams/[team_id]`>,
) {
    const { slug, team_id } = use(props.params);
    const organization = useOrganization();

    const { data: team } = useSuspenseQuery(
        trpc.teams.getTeam.queryOptions({
            organizationId: organization.id,
            teamId: team_id,
        }),
    ) as { data: TeamData };

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.teams,
                    team.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton to={Paths.org(slug).admin.teams}>
                                Teams
                            </Hermes.BackButton>
                            <ButtonGroup>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ team: ["update"] }}
                                >
                                    <Button variant="outline" asChild>
                                        <Link
                                            to={
                                                Paths.org(slug).admin.team(
                                                    team_id,
                                                ).update
                                            }
                                        >
                                            <ObjectIcons.Edit /> Edit
                                        </Link>
                                    </Button>
                                </Protect>
                                <AdminModule_TeamMenu
                                    organization={organization}
                                    team={team}
                                />
                            </ButtonGroup>
                        </Hermes.SectionHeader>

                        <Card>
                            <CardHeader>
                                <CardTitle>{team.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field>
                                        <FieldValue>{team.id}</FieldValue>
                                    </Field>
                                </FieldGroup>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldValue>
                                            <strong>Name:</strong> {team.name}
                                        </FieldValue>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldValue>
                                            <strong>Description:</strong>{" "}
                                            {team.description || "—"}
                                        </FieldValue>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldValue>
                                            <strong>Created:</strong>{" "}
                                            {formatDateTime(team.createdAt)}
                                        </FieldValue>
                                    </Field>
                                    {team.updatedAt && (
                                        <Field orientation="responsive">
                                            <FieldValue>
                                                <strong>Updated:</strong>{" "}
                                                {formatDateTime(team.updatedAt)}
                                            </FieldValue>
                                        </Field>
                                    )}
                                    {team.tags.length > 0 && (
                                        <Field orientation="responsive">
                                            <FieldValue>
                                                <strong>Tags:</strong>{" "}
                                                {team.tags.join(", ")}
                                            </FieldValue>
                                        </Field>
                                    )}
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
