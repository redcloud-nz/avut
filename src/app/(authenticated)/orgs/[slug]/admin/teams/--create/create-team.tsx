/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
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
import { Link } from "@/components/ui/link";
import { Textarea } from "@/components/ui/textarea";

import { OrganizationData } from "@/lib/schemas/organization";
import { ModifiableTeamData, TeamData } from "@/lib/schemas/team";
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

    const form = useForm({
        resolver: zodResolver(TeamData.modifiableSchema),
        defaultValues: {
            name: "",
            description: "",
            tags: [],
            properties: {},
        },
    });

    const mutation = useMutation(
        trpc.teams.createTeam.mutationOptions({
            async onError(error: any) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof ModifiableTeamData,
                        { message: error.message },
                    );
                }
            },
            async onSuccess(team) {
                queryClient.invalidateQueries(
                    trpc.teams.listTeams.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                router.push(
                    Paths.org(organization.slug).admin.team(team.id).href,
                );
            },
        }),
    );

    const handleCreate = form.handleSubmit((formData) => {
        toast.promise(
            async () => {
                await mutation.mutateAsync({
                    organizationId: organization.id,
                    team: formData,
                });
            },
            {
                loading: "Creating team...",
                success: "Team created successfully.",
                error: (error) => "Failed to create team: " + error.message,
            },
        );
    });

    return (
        <form id="create-team-form" onSubmit={handleCreate}>
            <FieldGroup>
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
                        form="create-team-form"
                        disabled={mutation.isPending}
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
                </Field>
            </FieldGroup>
        </form>
    );
}
