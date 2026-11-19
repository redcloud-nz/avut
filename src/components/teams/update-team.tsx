/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { teamsEffects } from "@/client/teams-effects";
import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/hooks/use-organization";
import { ModifiableTeamData, TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function Teams_UpdateTeam_Dialog({
    team,
    requireSlug = false,
    onUpdated,
}: {
    team: TeamData;
    /** The slug can be changed but not cleared (editing from the team's own space). */
    requireSlug?: boolean;
    /** Called after a successful update in place of closing the dialog — e.g. to navigate away. */
    onUpdated?: (updated: TeamData) => void;
}) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
    const dialogOpen = action === "update";

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(TeamData.formSchema(team.slug, { requireSlug })),
        defaultValues: { ...team, slug: team.slug ?? "" },
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
            async onSuccess({ updated }) {
                toast.success("Team updated");
                if (onUpdated) onUpdated(updated);
                else handleDialogOpenChange(false);
            },
        }),
    );

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ ...team, slug: team.slug ?? "" });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Update team">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update team</DialogTitle>
                    <DialogDescription>Update the details of this team record.</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form
                        id={formId}
                        onSubmit={form.handleSubmit(
                            (formData) =>
                                mutation.mutate({
                                    organizationId: organization.id,
                                    teamId: team.id,
                                    update: formData,
                                }),
                            (errors) => {
                                console.warn("Form validation errors:", errors);
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
                                        <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
                                        <Input
                                            id={`${formId}-name`}
                                            aria-invalid={fieldState.invalid}
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
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={`${formId}-description`}>
                                            Description
                                        </FieldLabel>
                                        <Textarea
                                            id={`${formId}-description`}
                                            aria-invalid={fieldState.invalid}
                                            {...field}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="slug"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={`${formId}-slug`}>Slug</FieldLabel>
                                        <Input
                                            id={`${formId}-slug`}
                                            autoComplete="off"
                                            className="font-mono"
                                            aria-invalid={fieldState.invalid}
                                            {...field}
                                            value={field.value ?? ""}
                                        />
                                        <FieldDescription>
                                            {requireSlug
                                                ? "Unique across AVUT. It can be changed here but not cleared, since that would close this team's space; clearing it is done from the organisation's Admin → Teams."
                                                : "Optional. Unique across AVUT. Setting one gives the team its own space; leave it blank to keep it off."}
                                        </FieldDescription>
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form={formId}
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
