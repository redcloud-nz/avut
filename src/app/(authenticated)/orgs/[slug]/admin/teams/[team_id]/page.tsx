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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";

import { AdminModule_TeamPersonnel_Section } from "./assigned-personnel";
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
    );

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
                                            <ObjectIcons.Edit />
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
                                    <Field orientation="responsive">
                                        <FieldLabel>Team ID</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={team.id}
                                            format="id"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Name</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={team.name}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Description</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={team.description}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Created</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={team.createdAt}
                                            format="dateTimeWithDistance"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Updated</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={team.updatedAt ?? "N/A"}
                                            format="dateTimeWithDistance"
                                        />
                                    </Field>
                                </FieldGroup>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>D4h Integration</CardTitle>
                                <FieldGroup className="px-4">
                                    <Field orientation="responsive">
                                        <FieldLabel>D4H Team ID</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={
                                                team.properties?.d4hTeamId ??
                                                "N/A"
                                            }
                                        />
                                    </Field>
                                </FieldGroup>
                            </CardHeader>
                        </Card>
                    </Hermes.Section>
                    <AdminModule_TeamPersonnel_Section
                        organization={organization}
                        team={team}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
