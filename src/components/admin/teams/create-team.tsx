/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { teamsEffects } from "@/client/teams-effects";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { ModifiableTeamData, TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

/**
 * Controlled create-team dialog — no trigger of its own. `open`/`onOpenChange` are driven
 * by the route: `(list)/--create/page.tsx` keeps this open and closes it by navigating
 * back to the teams list via `router.push`.
 */
export function AdminModule_CreateTeam_DialogContent({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const organization = useOrganization();
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
            meta: { effects: teamsEffects.createTeam },
            onError(error) {
                if (error.data?.conflict) {
                    form.setError(error.data.conflict.fieldName as keyof ModifiableTeamData, {
                        message: error.data.conflict.message,
                    });
                } else {
                    toast.error(`Failed to create team: ${error.message}`);
                    console.error("Failed to create team:", error);
                }
            },
            onSuccess({ created }) {
                router.push(
                    route("/orgs/[slug]/admin/teams/[team_id]", {
                        slug: organization.slug,
                        team_id: created.id,
                    }),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            mutation.mutate({
                organizationId: organization.id,
                create: formData,
            });
        },
        (errors) => {
            console.error("Form validation errors:", errors);
        },
    );

    function handleDialogOpenChange(nextOpen: boolean) {
        if (!nextOpen) {
            form.reset();
            mutation.reset();
        }
        onOpenChange(nextOpen);
    }

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
