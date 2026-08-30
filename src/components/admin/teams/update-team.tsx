/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { teamsEffects } from "@/client/teams-effects";
import { useOrganization } from "@/hooks/use-organization";
import { ModifiableTeamData, TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_UpdateTeam_Dialog({ team }: { team: TeamData }) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
    const dialogOpen = action === "update";

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
                handleDialogOpenChange(false);
            },
        }),
    );

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset(team);
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
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
