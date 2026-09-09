/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { useSession } from "@/client/auth-queries";
import { authQueryKeys } from "@/lib/auth-query-keys";
import { Alert } from "@/components/ui/alert";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { RainbowSpinner } from "@/components/ui/loading";
import { PasswordInput } from "@/components/ui/password-input";

export function UserPassword_Card({ hasCredentialAccount }: { hasCredentialAccount: boolean }) {
    return hasCredentialAccount ? <ChangePassword_Card /> : <SetPassword_Card />;
}

/**
 * For users signed in only through a social provider: there is no current password to
 * verify, so a password is set via an email OTP. `authClient.emailOtp.resetPassword`
 * creates the `credential` account when the user has none, so no server-only endpoint is
 * needed — the same client calls that back `/auth/forgot-password` → `/auth/reset-password`.
 */
function SetPassword_Card() {
    const sessionQuery = useSession();
    const queryClient = useQueryClient();
    const [codeSent, setCodeSent] = useState(false);

    const email = sessionQuery.data?.user.email;

    const sendCode = useMutation({
        async mutationFn(address: string) {
            await authClient.forgetPassword.emailOtp({ email: address }, { throw: true });
        },
        onSuccess() {
            setCodeSent(true);
            toast.success("We sent a 6-digit code to your email.");
        },
    });

    const form = useForm({
        resolver: zodResolver(
            z
                .object({
                    code: z.string().length(6, "Enter the 6-digit code"),
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
                })
                .refine((data) => data.newPassword === data.confirmNewPassword, {
                    message: "Passwords do not match",
                    path: ["confirmNewPassword"],
                }),
        ),
        defaultValues: { code: "", newPassword: "", confirmNewPassword: "" },
    });

    const setPassword = useMutation({
        async mutationFn(formData: { code: string; newPassword: string }) {
            const { error } = await authClient.emailOtp.resetPassword({
                email: email!,
                otp: formData.code,
                password: formData.newPassword,
            });
            if (error) {
                throw new Error(error.message ?? "Could not set your password.");
            }
        },
        onSuccess() {
            toast.success("Your password has been set. You can now sign in with it.");
            // Flips `hasCredentialAccount`, so `UserPassword_Card` swaps to the change-password form.
            void queryClient.invalidateQueries({ queryKey: authQueryKeys.linkedAccounts });
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Set Password</CardTitle>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Alert variant="warning">
                        You are currently signed in with a third-party provider and do not have a
                        password set. Set one to be able to sign in with your email address.
                    </Alert>

                    {sessionQuery.isPending ? (
                        <RainbowSpinner className="mx-auto" />
                    ) : !email ? (
                        <Alert variant="error">
                            Could not determine your email address. Please reload the page.
                        </Alert>
                    ) : !codeSent ? (
                        <>
                            {sendCode.isError && (
                                <Alert variant="error">{sendCode.error.message}</Alert>
                            )}
                            <Field orientation="horizontal">
                                <MutationButton
                                    type="button"
                                    status={sendCode.status}
                                    onClick={() => sendCode.mutate(email)}
                                    text={{
                                        idle: "Send verification code",
                                        pending: "Sending...",
                                        success: "Code sent",
                                    }}
                                />
                            </Field>
                        </>
                    ) : (
                        <form
                            id="set-password-form"
                            onSubmit={form.handleSubmit((data) => setPassword.mutate(data))}
                        >
                            <FieldGroup>
                                <Controller
                                    control={form.control}
                                    name="code"
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="set-password-code">
                                                Verification Code
                                            </FieldLabel>
                                            <InputOTP
                                                id="set-password-code"
                                                maxLength={6}
                                                value={field.value}
                                                onChange={field.onChange}
                                                pattern={REGEXP_ONLY_DIGITS}
                                                disabled={setPassword.isPending}
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
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    control={form.control}
                                    name="newPassword"
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor={field.name}>
                                                New Password
                                            </FieldLabel>
                                            <PasswordInput
                                                id={field.name}
                                                autoComplete="new-password"
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
                                    control={form.control}
                                    name="confirmNewPassword"
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor={field.name}>
                                                Confirm New Password
                                            </FieldLabel>
                                            <PasswordInput
                                                id={field.name}
                                                autoComplete="new-password"
                                                aria-invalid={fieldState.invalid}
                                                {...field}
                                            />
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                                {setPassword.isError && (
                                    <Alert variant="error">{setPassword.error.message}</Alert>
                                )}
                                <Field orientation="horizontal">
                                    <MutationButton
                                        form="set-password-form"
                                        status={setPassword.status}
                                        text={{
                                            idle: "Set Password",
                                            pending: "Setting...",
                                            success: "Password Set!",
                                        }}
                                        disabled={setPassword.isPending}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        disabled={sendCode.isPending || setPassword.isSuccess}
                                        onClick={() => sendCode.mutate(email)}
                                    >
                                        Resend code
                                    </Button>
                                </Field>
                            </FieldGroup>
                        </form>
                    )}
                </FieldGroup>
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
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmNewPassword: "",
            revokeOtherSessions: false,
        },
    });

    const mutation = useMutation({
        async mutationFn(formData: {
            currentPassword: string;
            newPassword: string;
            revokeOtherSessions: boolean;
        }) {
            const { error } = await authClient.changePassword({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword,
                revokeOtherSessions: formData.revokeOtherSessions,
            });
            if (error) {
                throw new Error(error.message ?? "Could not change your password.");
            }
        },
        onSuccess() {
            toast.success("Your password has been changed.");
            form.reset();
            mutation.reset();
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
                        {mutation.isError && (
                            <Alert variant="error">{mutation.error.message}</Alert>
                        )}
                        <Field orientation="horizontal">
                            <MutationButton
                                form="change-password-form"
                                status={mutation.status}
                                text={{
                                    idle: "Change Password",
                                    pending: "Changing...",
                                    success: "Password Changed!",
                                }}
                                disabled={mutation.isPending}
                            />
                        </Field>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
