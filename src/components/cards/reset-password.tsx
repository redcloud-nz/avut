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

import { S2_Button } from "@/components/ui/s2-button";
import {
    S2_Card,
    S2_CardContent,
    S2_CardDescription,
    S2_CardHeader,
    S2_CardTitle,
} from "@/components/ui/s2-card";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { S2_Input } from "@/components/ui/s2-input";
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
                router.push(Paths.auth.signIn(email).href);
            }
        } catch (error) {
            setState({
                status: "Error",
                error: { message: "Failed to reset password" },
            });
        }
    });

    return (
        <S2_Card>
            <S2_CardHeader>
                <S2_CardTitle>Reset Password</S2_CardTitle>
                <S2_CardDescription>
                    We sent a 6-digit code to your email. Enter the code along
                    with your new password to reset it.
                </S2_CardDescription>
            </S2_CardHeader>
            <S2_CardContent>
                <form id="forgot-password-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="code"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="forgot-password-email">
                                        Verification Code
                                    </FieldLabel>
                                    <InputOTP.Root
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
                                    <S2_Input
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
                            <S2_Button type="submit" onClick={handleSubmit}>
                                {state.status === "InProgress"
                                    ? "Updating Password..."
                                    : "Update Password"}
                            </S2_Button>
                        </Field>
                        {state.status === "Error" && (
                            <FieldError errors={[state.error]} />
                        )}
                    </FieldGroup>
                </form>
            </S2_CardContent>
        </S2_Card>
    );
}
