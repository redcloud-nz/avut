/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { Alert } from "@/components/ui/alert";
import { MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

export function UserPassword_Card({ hasCredentialAccount }: { hasCredentialAccount: boolean }) {
    return hasCredentialAccount ? <ChangePassword_Card /> : <SetPassword_Card />;
}

function SetPassword_Card() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Set Password</CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="warning">
                    You are currently signed in with a third-party provider and do not have a
                    password set.
                </Alert>
            </CardContent>
        </Card>
    );
}

function ChangePassword_Card() {
    const form = useForm({
        resolver: zodResolver(
            z
                .object({
                    currentPassword: z
                        .string()
                        .nonempty({ message: "Current password is required" })
                        .min(1)
                        .max(100),
                    newPassword: z
                        .string()
                        .nonempty({ message: "New password is required" })
                        .min(8)
                        .max(100),
                    confirmNewPassword: z
                        .string()
                        .nonempty({ message: "Please confirm your new password" })
                        .min(8)
                        .max(100),
                    revokeOtherSessions: z.boolean(),
                })
                .refine((data) => data.newPassword === data.confirmNewPassword, {
                    message: "Passwords do not match",
                    path: ["confirmNewPassword"],
                }),
        ),
    });

    const mutation = useMutation({
        async mutationFn(formData: {
            currentPassword: string;
            newPassword: string;
            revokeOtherSessions: boolean;
        }) {
            await authClient.changePassword({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword,
                revokeOtherSessions: formData.revokeOtherSessions,
            });
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
                <form
                    id="change-password-form"
                    onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                >
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="currentPassword"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={field.name}>Current Password</FieldLabel>
                                    <PasswordInput
                                        id={field.name}
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="newPassword"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={field.name}>New Password</FieldLabel>
                                    <PasswordInput
                                        id={field.name}
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="confirmNewPassword"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={field.name}>
                                        Confirm New Password
                                    </FieldLabel>
                                    <PasswordInput
                                        id={field.name}
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />

                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="revokeOtherSessions"
                            render={({ field }) => (
                                <Field orientation="horizontal">
                                    <Checkbox
                                        id={field.name}
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    <FieldLabel htmlFor={field.name}>
                                        Revoke other sessions
                                    </FieldLabel>
                                </Field>
                            )}
                        />
                        <Field orientation="horizontal">
                            <MutationButton
                                form="change-password-form"
                                status={mutation.status}
                                text={{
                                    idle: "Change Password",
                                    pending: "Changing...",
                                    success: "Password Changed!",
                                }}
                                disabled={mutation.status !== "idle"}
                            />
                        </Field>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
