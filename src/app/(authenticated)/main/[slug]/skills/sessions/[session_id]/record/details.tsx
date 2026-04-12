/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]/record
 */

"use client";

import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation } from "@tanstack/react-query";

import { DatePicker } from "@/components/controls/date-picker";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";
import { Textarea } from "@/components/ui/textarea";

import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillsModule_SessionRecord_Details_Tab({
    session,
}: {
    session: SkillCheckSession;
}) {
    const form = useForm({
        resolver: zodResolver(SkillCheckSession.modifiableSchema),
        defaultValues: session,
    });

    const mutation = useMutation(
        trpc.skills.updateSession.mutationOptions({
            onError(error) {
                console.error("Failed to update skill check session details", error);
                toast.error(`Failed to update session details. ${error.message}`);
            },
            onSuccess({ updated }, _variables, _onMutateResult, context) {
                toast.success("Session details updated");
                form.reset(updated);

                context.client.setQueryData(
                    trpc.skills.listSessions.queryKey({ organizationId: session.organizationId }),
                    (prev = []) => prev.map((s) => (s.id === updated.id ? updated : s)),
                );
            },
        }),
    );

    const debouncer = useDebouncer(mutation.mutate, { wait: 1000 });

    function handleChange() {
        debouncer.maybeExecute({
            organizationId: session.organizationId,
            skillCheckSessionId: session.id,
            update: form.getValues(),
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Session Details</CardTitle>
                <CardAction>
                    <SaveStatusIndicator status={mutation.status} />
                </CardAction>
            </CardHeader>
            <CardContent>
                <form onChange={handleChange}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field }) => (
                                <Field orientation="responsive">
                                    <FieldLabel>Name</FieldLabel>
                                    <Input {...field} />
                                </Field>
                            )}
                        />
                        <Controller
                            name="date"
                            control={form.control}
                            render={({ field }) => (
                                <Field orientation="responsive">
                                    <FieldLabel>Date</FieldLabel>
                                    <DatePicker
                                        className="min-w-1/2"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    />
                                </Field>
                            )}
                        />
                        <Controller
                            name="notes"
                            control={form.control}
                            render={({ field }) => (
                                <Field orientation="responsive">
                                    <FieldLabel>Notes</FieldLabel>
                                    <Textarea {...field} />
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
