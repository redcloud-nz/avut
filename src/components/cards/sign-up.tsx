/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { S2_Input } from "@/components/ui/s2-input";
import { Link } from "@/components/ui/link";

import { authClient } from "@/lib/auth-client";
import * as Paths from "@/paths";

import { SocialSignInButtons_Field } from "./sign-in";

export function Auth_SignUp_Card() {
    return (
        <S2_Card>
            <S2_CardHeader>
                <S2_CardTitle>Create an account</S2_CardTitle>
                <S2_CardDescription>
                    Enter your details to sign up.
                </S2_CardDescription>
            </S2_CardHeader>
            <S2_CardContent>
                <FieldGroup>
                    <Auth_EmailPasswordSignUp_Form />

                    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                        Or continue with
                    </FieldSeparator>

                    <SocialSignInButtons_Field />

                    <FieldDescription className="text-center">
                        Already have an account?{" "}
                        <Link to={Paths.auth.signIn}>Sign in</Link>
                    </FieldDescription>
                </FieldGroup>
            </S2_CardContent>
        </S2_Card>
    );
}

/**
 * Form form signing up with email and password.
 */
function Auth_EmailPasswordSignUp_Form() {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z.object({
                name: z.string().min(2, "Name is required."),
                email: z.email("Invalid email address"),
                password: z
                    .string()
                    .min(8, "Password must be at least 8 characters long"),
            }),
        ),
        defaultValues: {
            name: "",
            email: "",
            password: "",
        },
    });

    const [inProgress, setInProgress] = useState<boolean>(false);
    const [submitError, setSubmitError] = useState<{ message?: string } | null>(
        null,
    );

    const handleSignUp = form.handleSubmit(async (formData) => {
        setSubmitError(null);
        setInProgress(true);

        try {
            const { data, error } = await authClient.signUp.email(formData);

            if (error) {
                // We're assuming this is an expected error (like email already in use)
                console.log("Sign up error", error);
                setSubmitError(error);
            } else {
                // Successful signup. BetterAuth automatically sends a verification email.
                console.log("Sign up successful", data);
                router.push(Paths.auth.verifyEmail(data.user.email).href);
            }
        } catch (error) {
            // We're assuming this is an unexpected error
            console.error("Sign up error", error);
            toast.error("An error occured during sign up. Please try again.");
        }

        setInProgress(false);
    });

    return (
        <form id="sign-up-form" onSubmit={handleSignUp}>
            <FieldGroup>
                <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="sign-up-name">Name</FieldLabel>
                            <S2_Input
                                id="sign-up-name"
                                placeholder="Your full name"
                                aria-invalid={fieldState.invalid}
                                disabled={inProgress}
                                {...field}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="email">
                                Email Address
                            </FieldLabel>
                            <S2_Input
                                id="email"
                                type="email"
                                placeholder="Your email address"
                                aria-invalid={fieldState.invalid}
                                disabled={inProgress}
                                {...field}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="sign-up-password">
                                Password
                            </FieldLabel>
                            <S2_Input
                                id="sign-up-password"
                                type="password"
                                placeholder="Your password"
                                aria-invalid={fieldState.invalid}
                                disabled={inProgress}
                                {...field}
                            />
                            <FieldDescription>
                                Must be at least 8 characters long.
                            </FieldDescription>
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Field>
                    <S2_Button
                        type="submit"
                        form="sign-up-form"
                        disabled={inProgress}
                    >
                        {inProgress ? "Creating account..." : "Sign Up"}
                    </S2_Button>
                    {submitError && <FieldError errors={[submitError]} />}
                </Field>
            </FieldGroup>
        </form>
    );
}
