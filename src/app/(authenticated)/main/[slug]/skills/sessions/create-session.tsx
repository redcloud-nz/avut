/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm, Watch } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { DatePicker } from "@/components/controls/date-picker";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
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
import { SkillCheckSession, SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillsModule_CreateSession_Dialog({ ...props }: DialogProps) {
    const organization = useOrganization();

    const form = useForm({
        resolver: zodResolver(SkillCheckSession.modifiableSchema),
        defaultValues: {
            name: "",
            date: new Date().toISOString(),
            notes: "",
            status: "Draft" as const,
        },
    });

    const mutation = useMutation(
        trpc.skills.createSession.mutationOptions({
            onError(error) {
                console.error("Failed to create session", error);
                toast.error(`Failed to create session ${error.message}`);
            },
            onSuccess(result, _data, _onMutateResult, context) {
                toast.success("Session created");

                handleOpenChange(false);

                context.client.invalidateQueries(
                    trpc.skills.listSessions.queryFilter({ organizationId: organization.id }),
                );
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }

        props.onOpenChange?.(open);
    }

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Session</DialogTitle>
                    <DialogDescription>
                        Create a new skill check session. You can add skill checks to the session
                        after it's created.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="new-session-form"
                    onSubmit={form.handleSubmit((formData) =>
                        mutation.mutate({
                            organizationId: organization.id,
                            skillCheckSessionId: SkillCheckSessionId.create(),
                            create: formData,
                        }),
                    )}
                >
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel>Name</FieldLabel>
                                    <Input {...field} placeholder="Session Name" />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="date"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel>Date</FieldLabel>
                                    <DatePicker
                                        value={field.value}
                                        onValueChange={(newValue) => field.onChange(newValue)}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />

                        <Controller
                            name="notes"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel>Notes</FieldLabel>
                                    <Textarea {...field} placeholder="Session Notes" />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Field orientation="horizontal">
                            <MutationButton
                                type="submit"
                                form="new-session-form"
                                status={mutation.status}
                                text={{
                                    idle: "Create",
                                    pending: "Creating...",
                                    success: "Created",
                                }}
                            />
                        </Field>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
