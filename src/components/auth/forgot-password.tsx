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
import { MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PasswordInput } from "@/components/ui/password-input";
import { authUrl, SIGN_IN_PATH } from "@/lib/auth-redirect";
import { ConfirmPasswordSchema, PasswordSchema } from "@/lib/schemas/password";

/**
 * Single-card forgot/reset-password flow: an email step that sends a 6-digit code, then a
 * code + new-password step, both against `authClient.emailOtp`. Kept as one component (rather
 * than a page per step) so the in-flight email never has to round-trip through a URL param.
 *
 * @param email Optional email to pre-fill in the first step.
 * @param redirectTo Optional path to carry through to the sign-in page after the reset.
 */
export function Auth_ForgotPassword_Card({
    email,
    redirectTo,
}: {
    email?: string;
    redirectTo?: string;
} = {}) {
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
                        <ResetPassword_Form
                            email={sentTo}
                            redirectTo={redirectTo}
                            onChangeEmail={() => setSentTo(null)}
                        />
                    ) : (
                        <RequestCode_Form email={email} onSent={setSentTo} />
                    )}
                    <FieldDescription className="text-center">
                        Remembered your password?{" "}
                        <Link href={authUrl(SIGN_IN_PATH, { email, returnTo: redirectTo })}>
                            Sign in
                        </Link>
                    </FieldDescription>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

function RequestCode_Form({ email, onSent }: { email?: string; onSent: (email: string) => void }) {
    const form = useForm({
        resolver: zodResolver(
            z.object({
                email: z.email("Invalid email address"),
            }),
        ),
        defaultValues: { email: email ?? "" },
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

function ResetPassword_Form({
    email,
    redirectTo,
    onChangeEmail,
}: {
    email: string;
    redirectTo?: string;
    onChangeEmail: () => void;
}) {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z
                .object({
                    code: z.string().length(6, "Invalid code"),
                    newPassword: PasswordSchema,
                    confirmNewPassword: ConfirmPasswordSchema,
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
            router.push(authUrl(SIGN_IN_PATH, { email, returnTo: redirectTo }));
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
            onSubmit={form.handleSubmit(({ confirmNewPassword: _confirmNewPassword, ...data }) =>
                resetPassword.mutate(data),
            )}
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
                <FieldDescription className="text-center">
                    Didn&apos;t receive the code?{" "}
                    <button
                        type="button"
                        aria-disabled={resendCode.isPending || resetPassword.isSuccess}
                        className="cursor-pointer underline-offset-4 hover:underline aria-disabled:pointer-events-none aria-disabled:opacity-50"
                        onClick={() => {
                            if (!resendCode.isPending && !resetPassword.isSuccess) {
                                resendCode.mutate();
                            }
                        }}
                    >
                        Resend
                    </button>
                </FieldDescription>
                <FieldDescription className="text-center">
                    Wrong email?{" "}
                    <button
                        type="button"
                        className="cursor-pointer underline-offset-4 hover:underline"
                        onClick={onChangeEmail}
                    >
                        Start over
                    </button>
                </FieldDescription>
            </FieldGroup>
        </form>
    );
}
