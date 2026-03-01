/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]/--update
 */
"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { Controller, useForm, Watch } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { useTeam } from "@/hooks/use-team";
import { ModifiableTeamData, TeamData } from "@/lib/schemas/team";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export default function AdminModule_TeamUpdate_Page(
    props: PageProps<`/orgs/[slug]/admin/teams/[team_id]/--update`>,
) {
    const { slug, team_id } = use(props.params);
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const team = useTeam(team_id);

    const form = useForm({
        resolver: zodResolver(TeamData.modifiableSchema),
        defaultValues: team,
    });

    const mutation = useMutation(
        trpc.teams.updateTeam.mutationOptions({
            async onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof ModifiableTeamData,
                        { message: error.message },
                    );
                } else {
                    console.error("Failed to update team", error);
                    toast.error(`Failed to update team: ${error.message}`);
                }
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.teams.listTeams.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                router.push(
                    Paths.org(organization.slug).admin.team(team.id).index.href,
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            teamId: team.id,
            update: formData,
        });
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.teams,
                    Paths.org(slug).admin.team(team).index,
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={Paths.org(slug).admin.team(team_id).index}
                            tooltip={`Back to team: ${team.name}`}
                        />
                        <Watch
                            control={form.control}
                            names={["name"]}
                            render={([name]) => (
                                <Hermes.Title>{name}</Hermes.Title>
                            )}
                        />
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Update Team</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form id="update-team-form" onSubmit={handleSubmit}>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Team ID</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            format="id"
                                        >
                                            {team.id}
                                        </FieldValue>
                                    </Field>
                                    <Controller
                                        name="name"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                                orientation="responsive"
                                            >
                                                <FieldLabel htmlFor="team-name">
                                                    Name
                                                </FieldLabel>
                                                <Input
                                                    id="team-name"
                                                    aria-invalid={
                                                        fieldState.invalid
                                                    }
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <FieldError
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
                                                    />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        name="description"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                                orientation="responsive"
                                            >
                                                <FieldLabel htmlFor="team-description">
                                                    Description
                                                </FieldLabel>
                                                <Textarea
                                                    id="team-description"
                                                    aria-invalid={
                                                        fieldState.invalid
                                                    }
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <FieldError
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
                                                    />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Field orientation="horizontal">
                                        <MutationButton
                                            type="submit"
                                            form="update-team-form"
                                            status={mutation.status}
                                            text={{
                                                idle: "Update",
                                                pending: "Updating",
                                                success: "Updated",
                                            }}
                                        />
                                        <Show when={mutation.isIdle}>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => form.reset()}
                                                asChild
                                            >
                                                <Link
                                                    to={
                                                        Paths.org(
                                                            organization.slug,
                                                        ).admin.team(team.id)
                                                            .index
                                                    }
                                                >
                                                    Cancel
                                                </Link>
                                            </Button>
                                        </Show>
                                    </Field>
                                </FieldGroup>
                            </form>
                        </CardContent>
                    </Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
