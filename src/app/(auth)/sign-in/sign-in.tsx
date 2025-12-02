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

import {
    S2_Card,
    S2_CardContent,
    S2_CardDescription,
    S2_CardHeader,
    S2_CardTitle,
} from "@/components/ui/s2-card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { S2_Input } from "@/components/ui/s2-input";
import { S2_Button } from "@/components/ui/s2-button";
import { Link } from "@/components/ui/link";

import { authClient } from "@/lib/auth-client";
import * as Paths from "@/paths";

import { Auth_SocialSignIn } from "../social-sign-in";

export function Auth_SignIn_Card() {
    return (
        <S2_Card>
            <S2_CardHeader>
                <S2_CardTitle>Login to your account</S2_CardTitle>
                <S2_CardDescription>
                    Enter your email below to login to your account
                </S2_CardDescription>
            </S2_CardHeader>
            <S2_CardContent>
                <FieldGroup>
                    <AuthEmailPasswordSignIn_Form />
                    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                        Or continue with
                    </FieldSeparator>
                    <Auth_SocialSignIn />
                    <FieldDescription className="text-center">
                        Don't have an account?{" "}
                        <Link to={Paths.auth.signUp}>Sign Up</Link>
                    </FieldDescription>
                </FieldGroup>
            </S2_CardContent>
        </S2_Card>
    );
}

function AuthEmailPasswordSignIn_Form() {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z.object({
                email: z.email("Invalid email address"),
                password: z.string(),
                rememberMe: z.boolean(),
            }),
        ),
        defaultValues: {
            email: "",
            password: "",
            rememberMe: true,
        },
    });

    const [inProgress, setInProgress] = useState<boolean>(false);
    const [submitError, setSubmitError] = useState<{ message?: string } | null>(
        null,
    );

    const handleSignIn = form.handleSubmit(async (formData) => {
        try {
            setInProgress(true);
            const { data, error } = await authClient.signIn.email(formData);

            if (error) {
                console.error("Sign in error", error);
                setSubmitError(error);
            } else {
                console.log("Sign in successful", data);

                if (data.user.emailVerified) {
                    router.push(Paths.orgs.select.href);
                } else {
                    router.push(Paths.auth.verifyEmail(data.user.email).href);
                }
            }
        } catch (error) {
            console.error("Sign in error", error);
            toast.error("An error occured during sign in. Please try again.");
        } finally {
            setInProgress(false);
        }
    });

    return (
        <form id="sign-in-form" onSubmit={handleSignIn}>
            <FieldGroup>
                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="sign-in-email">
                                Email Address
                            </FieldLabel>
                            <S2_Input
                                id="sign-in-email"
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
                <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <div className="flex items-center">
                                <FieldLabel htmlFor="sign-in-password">
                                    Password
                                </FieldLabel>
                                <Link
                                    to={Paths.auth.forgotPassword}
                                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                                >
                                    Forgot password?
                                </Link>
                            </div>

                            <S2_Input
                                id="sign-in-password"
                                type="password"
                                placeholder="Your password"
                                aria-invalid={fieldState.invalid}
                                {...field}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Controller
                    name="rememberMe"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="horizontal"
                        >
                            <Checkbox
                                id="sign-in-rememberMe"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                aria-invalid={fieldState.invalid}
                            />
                            <FieldLabel htmlFor="sign-in-rememberMe">
                                Remember me
                            </FieldLabel>
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Field>
                    <S2_Button
                        type="submit"
                        form="sign-in-form"
                        disabled={inProgress}
                    >
                        {inProgress ? "Signing in..." : "Login"}
                    </S2_Button>
                </Field>
                {submitError && <FieldError errors={[submitError]} />}
            </FieldGroup>
        </form>
    );
}
