/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";

import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PasswordInput } from "@/components/ui/password-input";

/**
 * Single-card forgot/reset-password flow: an email step that sends a 6-digit code, then a
 * code + new-password step, both against `authClient.emailOtp`. Kept as one component (rather
 * than a page per step) so the in-flight email never has to round-trip through a URL param.
 */
export function Auth_ForgotPassword_Card() {
    const [sentTo, setSentTo] = useState<string | null>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{sentTo ? "Reset Password" : "Forgot Password"}</CardTitle>
                <CardDescription>
                    {sentTo
                        ? `Enter the 6-digit code we sent to ${sentTo}, along with your new password.`
                        : "Enter your email to get a reset code sent to you."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    {sentTo ? (
                        <ResetPassword_Form email={sentTo} />
                    ) : (
                        <RequestCode_Form onSent={setSentTo} />
                    )}
                    <FieldDescription className="text-center">
                        Remembered your password? <Link href="/auth/sign-in">Sign in</Link>
                    </FieldDescription>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

function RequestCode_Form({ onSent }: { onSent: (email: string) => void }) {
    const form = useForm({
        resolver: zodResolver(
            z.object({
                email: z.email("Invalid email address"),
            }),
        ),
    });

    const mutation = useMutation({
        async mutationFn(formData: { email: string }) {
            const { data, error } = await authClient.forgetPassword.emailOtp({
                email: formData.email,
            });
            if (error) {
                throw new Error(error.message ?? "Unable to send reset code.");
            }
            return data;
        },
        onSuccess(_, variables) {
            onSent(variables.email);
        },
    });

    return (
        <form id="forgot-password-form" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
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
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
                <Field>
                    <MutationButton
                        type="submit"
                        form="forgot-password-form"
                        status={mutation.status}
                        text={{
                            idle: "Send reset code",
                            pending: "Sending...",
                            success: "Sent!",
                        }}
                    />
                </Field>
                {mutation.isError && <FieldError errors={[mutation.error]} />}
            </FieldGroup>
        </form>
    );
}

function ResetPassword_Form({ email }: { email: string }) {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z
                .object({
                    code: z.string().length(6, "Invalid code"),
                    newPassword: z
                        .string()
                        .nonempty({ message: "New password is required" })
                        .min(8, "Password must be at least 8 characters")
                        .max(100, "Password must be at most 100 characters"),
                    confirmNewPassword: z
                        .string()
                        .nonempty({ message: "Please confirm your new password" }),
                })
                .refine((data) => data.newPassword === data.confirmNewPassword, {
                    message: "Passwords do not match",
                    path: ["confirmNewPassword"],
                }),
        ),
        defaultValues: { code: "", newPassword: "", confirmNewPassword: "" },
    });

    const resetPassword = useMutation({
        async mutationFn(formData: { code: string; newPassword: string }) {
            const { data, error } = await authClient.emailOtp.resetPassword({
                email,
                otp: formData.code,
                password: formData.newPassword,
            });
            if (error) {
                throw new Error(error.message ?? "Unable to reset password.");
            }
            return data;
        },
        onSuccess() {
            router.push(`/auth/sign-in?email=${encodeURIComponent(email)}`);
        },
    });

    const resendCode = useMutation({
        async mutationFn() {
            const { error } = await authClient.forgetPassword.emailOtp({ email });
            if (error) {
                throw new Error(error.message ?? "Unable to resend reset code.");
            }
        },
        onSuccess() {
            toast.success("We sent a new code to your email.");
        },
    });

    return (
        <form
            id="reset-password-form"
            onSubmit={form.handleSubmit((data) => resetPassword.mutate(data))}
        >
            <FieldGroup>
                <Controller
                    name="code"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="verification-code">Verification Code</FieldLabel>
                            <InputOTP
                                id="verification-code"
                                maxLength={6}
                                value={field.value}
                                onChange={field.onChange}
                                pattern={REGEXP_ONLY_DIGITS}
                                disabled={resetPassword.isPending}
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
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
                <Controller
                    name="newPassword"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="new-password">New Password</FieldLabel>
                            <PasswordInput
                                id="new-password"
                                autoComplete="new-password"
                                placeholder="Enter your new password"
                                aria-invalid={fieldState.invalid}
                                {...field}
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
                <Controller
                    name="confirmNewPassword"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="confirm-new-password">
                                Confirm New Password
                            </FieldLabel>
                            <PasswordInput
                                id="confirm-new-password"
                                autoComplete="new-password"
                                placeholder="Enter your new password again"
                                aria-invalid={fieldState.invalid}
                                {...field}
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
                {resetPassword.isError && <FieldError errors={[resetPassword.error]} />}
                {resendCode.isError && <FieldError errors={[resendCode.error]} />}
                <Field orientation="horizontal" className="justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={resendCode.isPending || resetPassword.isSuccess}
                        onClick={() => resendCode.mutate()}
                    >
                        Resend code
                    </Button>
                    <MutationButton
                        type="submit"
                        form="reset-password-form"
                        status={resetPassword.status}
                        text={{
                            idle: "Update Password",
                            pending: "Updating Password...",
                            success: "Password updated!",
                        }}
                    />
                </Field>
            </FieldGroup>
        </form>
    );
}
