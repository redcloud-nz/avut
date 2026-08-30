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
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { teamsEffects } from "@/client/teams-effects";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { ModifiableTeamData, TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

/**
 * Controlled update-team dialog — no trigger of its own. `open`/`onOpenChange` are driven
 * by the route: `--update/page.tsx` keeps this open and closes it by navigating back to
 * the team detail page.
 */
export function AdminModule_UpdateTeam_DialogContent({
    team,
    open,
    onOpenChange,
}: {
    team: TeamData;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const organization = useOrganization();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(TeamData.modifiableSchema),
        defaultValues: team,
    });

    const mutation = useMutation(
        trpc.teams.updateTeam.mutationOptions({
            meta: { effects: teamsEffects.updateTeam },
            async onError(error) {
                if (error.data?.conflict) {
                    form.setError(error.data.conflict.fieldName as keyof ModifiableTeamData, {
                        message: error.data.conflict.message,
                    });
                } else {
                    console.error("Failed to update team", error);
                    toast.error(`Failed to update team: ${error.message}`);
                }
            },
            async onSuccess() {
                toast.success("Team updated");
                router.push(
                    route("/orgs/[slug]/admin/teams/[team_id]", {
                        slug: organization.slug,
                        team_id: team.id,
                    }),
                );
            },
        }),
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
                    <DialogTitle>Update team</DialogTitle>
                    <DialogDescription>Update the details of this team record.</DialogDescription>
                </DialogHeader>
                <form
                    id="update-team-form"
                    onSubmit={form.handleSubmit(
                        (formData) =>
                            mutation.mutate({
                                organizationId: organization.id,
                                teamId: team.id,
                                update: formData,
                            }),
                        (errors) => {
                            console.error("Form validation errors:", errors);
                        },
                    )}
                >
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Team ID</FieldLabel>
                            <FieldValue value={team.id} format="id" />
                        </Field>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="team-name">Name</FieldLabel>
                                    <Input
                                        id="team-name"
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
                        form="update-team-form"
                        status={mutation.status}
                        text={{
                            idle: "Update",
                            pending: "Updating...",
                            success: "Updated",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
