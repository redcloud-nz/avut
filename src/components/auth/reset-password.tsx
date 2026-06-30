/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function ResetPassword_Card({ email }: { email: string }) {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z.object({
                code: z.string().length(6, "Invalid code"),
                newPassword: z.string().min(8, "Password must be at least 8 characters"),
            }),
        ),
    });

    const mutation = useMutation({
        async mutationFn(formData: { code: string; newPassword: string }) {
            return await authClient.emailOtp.resetPassword(
                {
                    email,
                    otp: formData.code,
                    password: formData.newPassword,
                },
                { throw: true },
            );
        },
        onSuccess() {
            router.push(`/auth/sign-in?email=${encodeURIComponent(email)}`);
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Reset Password</CardTitle>
                <CardDescription>
                    We sent a 6-digit code to your email. Enter the code along with your new
                    password to reset it.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    id="reset-password-form"
                    onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                >
                    <FieldGroup>
                        <Controller
                            name="code"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="verification-code">
                                        Verification Code
                                    </FieldLabel>
                                    <InputOTP
                                        id="verification-code"
                                        maxLength={6}
                                        value={field.value}
                                        onChange={field.onChange}
                                        pattern={REGEXP_ONLY_DIGITS}
                                        disabled={mutation.isPending}
                                        aria-invalid={fieldState.invalid}
                                    >
                                        <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border">
                                            <InputOTPSlot index={0} />
                                            <InputOTPSlot index={1} />
                                            <InputOTPSlot index={2} />
                                            <InputOTPSlot index={3} />
                                            <InputOTPSlot index={4} />
                                            <InputOTPSlot index={5} />
                                        </InputOTPGroup>
                                    </InputOTP>
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="newPassword"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="new-password">New Password</FieldLabel>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        placeholder="Enter your new password"
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
                                form="reset-password-form"
                                status={mutation.status}
                                text={{
                                    idle: "Update Password",
                                    pending: "Updating Password...",
                                    success: "Password updated!",
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
