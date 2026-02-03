/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP } from "@/components/ui/input-otp";

import { authClient } from "@/lib/auth-client";
import * as Paths from "@/paths";

export function ResetPassword_Card({ email }: { email: string }) {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z.object({
                code: z.string().length(6, "Invalid code"),
                newPassword: z
                    .string()
                    .min(8, "Password must be at least 8 characters"),
            }),
        ),
    });

    const [state, setState] = useState<
        | { status: "Ready" | "InProgress" }
        | { status: "Error"; error: { message?: string } }
    >({ status: "Ready" });

    const handleSubmit = form.handleSubmit(async (formData) => {
        setState({ status: "InProgress" });
        try {
            const { data, error } = await authClient.emailOtp.resetPassword({
                email,
                otp: formData.code,
                password: formData.newPassword,
            });

            if (error) {
                console.error("Reset password error", error);
                setState({ status: "Error", error });
            } else {
                console.log("Reset password successful", data);
                router.push(Paths.auth.signIn({ email }).href);
            }
        } catch (error) {
            setState({
                status: "Error",
                error: { message: "Failed to reset password" },
            });
        }
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Reset Password</CardTitle>
                <CardDescription>
                    We sent a 6-digit code to your email. Enter the code along
                    with your new password to reset it.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form id="forgot-password-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="code"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="verification-code">
                                        Verification Code
                                    </FieldLabel>
                                    <InputOTP.Root
                                        id="verification-code"
                                        maxLength={6}
                                        value={field.value}
                                        onChange={field.onChange}
                                        pattern={REGEXP_ONLY_DIGITS}
                                        disabled={state.status === "InProgress"}
                                        aria-invalid={fieldState.invalid}
                                    >
                                        <InputOTP.Group className="gap-2.5 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border">
                                            <InputOTP.Slot index={0} />
                                            <InputOTP.Slot index={1} />
                                            <InputOTP.Slot index={2} />
                                            <InputOTP.Slot index={3} />
                                            <InputOTP.Slot index={4} />
                                            <InputOTP.Slot index={5} />
                                        </InputOTP.Group>
                                    </InputOTP.Root>
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="newPassword"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="new-password">
                                        New Password
                                    </FieldLabel>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        placeholder="Enter your new password"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Field>
                            <Button type="submit" onClick={handleSubmit}>
                                {state.status === "InProgress"
                                    ? "Updating Password..."
                                    : "Update Password"}
                            </Button>
                        </Field>
                        {state.status === "Error" && (
                            <FieldError errors={[state.error]} />
                        )}
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
