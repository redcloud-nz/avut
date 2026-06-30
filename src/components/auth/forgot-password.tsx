/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";

import { MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function Auth_ForgotPassword_Card() {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z.object({
                email: z.email("Invalid email address"),
            }),
        ),
    });

    const mutation = useMutation({
        async mutationFn(formData: { email: string }) {
            return await authClient.forgetPassword.emailOtp(
                {
                    email: formData.email,
                },
                { throw: true },
            );
        },
        onSuccess(_, variables) {
            router.push(`/auth/reset-password?email=${encodeURIComponent(variables.email)}`);
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Forgot Password</CardTitle>
                <CardDescription>Enter your email to get a reset code sent to you.</CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    id="forgot-password-form"
                    onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                >
                    <FieldGroup>
                        <Controller
                            name="email"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="forgot-password-email">Email</FieldLabel>
                                    <Input
                                        id="forgot-password-email"
                                        type="email"
                                        placeholder="you@example.com"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                        <Field>
                            <MutationButton
                                type="submit"
                                form="forgot-password-form"
                                status={mutation.status}
                                text={{
                                    idle: "Send reset link",
                                    pending: "Sending...",
                                    success: "Sent!",
                                }}
                            />
                        </Field>
                        {mutation.isError && (
                            <FieldError errors={[mutation.error as { message?: string }]} />
                        )}
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
