/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { ModifiableTeamData, TeamData } from "@/lib/schemas/team";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export function AdminModule_CreateTeam_Dialog(props: DialogProps) {
    const organization = useOrganization();
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
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(error.shape.cause.message as keyof ModifiableTeamData, {
                        message: error.message,
                    });
                } else {
                    toast.error(`Failed to create team: ${error.message}`);
                    console.error("Failed to create team:", error);
                }
            },
            async onSuccess({ created }) {
                await queryClient.invalidateQueries(
                    trpc.teams.listTeams.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                props.onOpenChange?.(false);

                router.push(Paths.main(organization.slug).admin.team(created.id).index.href);
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            create: formData,
        });
    });

    useEffect(() => {
        if (!props.open) {
            form.reset();
            mutation.reset();
        }
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Team</DialogTitle>
                    <DialogDescription>Create a new team.</DialogDescription>
                </DialogHeader>
                <form id="create-team-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="team-name">Name</FieldLabel>
                                    <Input
                                        id="team-name"
                                        autoFocus
                                        autoComplete="off"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="description"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="team-description">Description</FieldLabel>
                                    <Textarea
                                        id="team-description"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Field orientation="horizontal">
                            <MutationButton
                                type="submit"
                                form="create-team-form"
                                status={mutation.status}
                                text={{
                                    idle: "Create",
                                    pending: "Creating",
                                    success: "Created",
                                }}
                            />
                            <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                        </Field>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
