/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Textarea } from "@/components/ui/textarea";
import { FieldValue } from "@/components/ui/field-value";

import { OrganizationData } from "@/lib/schemas/organization";
import { TeamData, TeamId } from "@/lib/schemas/team";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";

type AdminModule_CreateTeam_FormProps = {
    organization: OrganizationData;
};

export function AdminModule_CreateTeam_Form({
    organization,
}: AdminModule_CreateTeam_FormProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const teamId = useMemo(() => TeamId.create(), []);

    const form = useForm({
        resolver: zodResolver(
            TeamData.schema.pick({
                name: true,
                description: true,
                tags: true,
                properties: true,
            }),
        ),
        defaultValues: {
            name: "",
            description: "",
            tags: [],
            properties: {},
        },
    });

    const createTeamMutation = useMutation(
        trpc.teams.createTeam.mutationOptions({
            async onError(error: any) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof Pick<
                            TeamData,
                            "name" | "description" | "tags" | "properties"
                        >,
                        { message: error.message },
                    );
                } else {
                    toast.error(`Error creating team: ${error.message}`);
                }
            },
            async onSuccess() {
                queryClient.invalidateQueries(
                    trpc.teams.listTeams.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                toast.success("Team created successfully.");
                router.push(
                    Paths.org(organization.slug).admin.team(teamId).href,
                );
            },
        }),
    );

    return (
        <form
            id="create-team-form"
            onSubmit={form.handleSubmit((formData) =>
                createTeamMutation.mutate({
                    organizationId: organization.id,
                    ...formData,
                }),
            )}
        >
            <FieldGroup>
                <Field orientation="responsive">
                    <FieldLabel>Team ID</FieldLabel>
                    <FieldValue className="min-w-1/2">{teamId}</FieldValue>
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
            </FieldGroup>
            <FieldGroup>
                <Button
                    type="submit"
                    form="create-team-form"
                    disabled={createTeamMutation.isPending}
                >
                    Create
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    asChild
                >
                    <Link to={Paths.org(organization.slug).admin.teams}>
                        Cancel
                    </Link>
                </Button>
            </FieldGroup>
        </form>
    );
}
