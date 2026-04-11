/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]/record
 */

"use client";

import { Controller, useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { DatePicker } from "@/components/controls/date-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { SkillCheckSession } from "@/lib/schemas/skill-check-session";

export function SkillsModule_SessionRecord_Details_Tab({
    session,
}: {
    session: SkillCheckSession;
}) {
    const form = useForm({
        resolver: zodResolver(SkillCheckSession.modifiableSchema),
        defaultValues: session,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Session Details</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
        </Card>
    );
}
