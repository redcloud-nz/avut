/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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

import { authClient } from "@/lib/auth-client";
import * as Paths from "@/paths";

export function ForgotPassword_Card() {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z.object({
                email: z.email("Invalid email address"),
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
            const { data, error } = await authClient.forgetPassword.emailOtp({
                email: formData.email,
            });

            if (error) {
                console.error("Forgot password error", error);
                setState({ status: "Error", error });
            } else {
                console.log("Forgot password email sent", data);
                router.push(Paths.auth.resetPassword(formData.email).href);
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
                <S2_CardTitle>Forgot Password</S2_CardTitle>
                <S2_CardDescription>
                    Enter your email to get an a reset code sent to you.
                </S2_CardDescription>
            </S2_CardHeader>
            <S2_CardContent>
                <form id="forgot-password-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="email"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="forgot-password-email">
                                        Email
                                    </FieldLabel>
                                    <S2_Input
                                        id="forgot-password-email"
                                        type="email"
                                        placeholder="you@example.com"
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
                            <S2_Button
                                type="submit"
                                form="forgot-password-form"
                                disabled={state.status === "InProgress"}
                            >
                                Send reset link
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
