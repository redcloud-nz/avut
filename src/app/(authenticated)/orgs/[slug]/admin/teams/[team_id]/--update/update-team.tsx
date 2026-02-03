/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/components/ui/link";
import { FieldValue } from "@/components/ui/field-value";

import { OrganizationData } from "@/lib/schemas/organization";
import { TeamData } from "@/lib/schemas/team";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";

type AdminModule_UpdateTeam_FormProps = {
    organization: OrganizationData;
    team: TeamData;
};

export function AdminModule_UpdateTeam_Form({
    organization,
    team,
}: AdminModule_UpdateTeam_FormProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            TeamData.schema.pick({
                name: true,
                description: true,
                tags: true,
                properties: true,
            }),
        ),
        defaultValues: team,
    });

    const mutation = useMutation(
        trpc.teams.updateTeam.mutationOptions({
            async onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof Pick<
                            TeamData,
                            "name" | "description" | "tags" | "properties"
                        >,
                        { message: error.shape.message },
                    );
                } else {
                    toast.error(
                        `Failed to update team: ${error.message || "Unknown error"}`,
                    );
                }
            },
            async onSuccess() {
                toast.success("Team updated successfully.");
                await Promise.all([
                    queryClient.invalidateQueries(
                        trpc.teams.getTeam.queryFilter({
                            organizationId: organization.id,
                            teamId: team.id,
                        }),
                    ),
                    queryClient.invalidateQueries(
                        trpc.teams.listTeams.queryFilter({
                            organizationId: organization.id,
                        }),
                    ),
                ]);

                router.push(
                    Paths.org(organization.slug).admin.team(team.id).href,
                );
            },
        }),
    );

    return (
        <form
            id="update-team-form"
            onSubmit={form.handleSubmit((formData) =>
                mutation.mutate({
                    organizationId: organization.id,
                    teamId: team.id,
                    ...formData,
                }),
            )}
        >
            <FieldGroup>
                <Field orientation="responsive">
                    <FieldLabel>Team ID</FieldLabel>
                    <FieldValue className="min-w-1/2">{team.id}</FieldValue>
                </Field>
                <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="responsive"
                        >
                            <FieldLabel htmlFor="team-name">Name</FieldLabel>
                            <Input
                                id="team-name"
                                aria-invalid={fieldState.invalid}
                                className="min-w-1/2"
                                {...field}
                            />
                            {fieldState.error && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Controller
                    name="description"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="responsive"
                        >
                            <FieldLabel htmlFor="team-description">
                                Description
                            </FieldLabel>
                            <Textarea
                                id="team-description"
                                aria-invalid={fieldState.invalid}
                                className="min-w-1/2"
                                {...field}
                            />
                            {fieldState.error && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Field orientation="horizontal">
                    <Button
                        type="submit"
                        form="update-team-form"
                        disabled={mutation.isPending}
                    >
                        Update
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        asChild
                    >
                        <Link
                            to={Paths.org(organization.slug).admin.team(
                                team.id,
                            )}
                        >
                            Cancel
                        </Link>
                    </Button>
                </Field>
            </FieldGroup>
        </form>
    );
}
