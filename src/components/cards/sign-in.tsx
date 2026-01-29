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
import { SiApple, SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

import { authClient } from "@/lib/auth-client";
import * as Paths from "@/paths";

/**
 * Card for a user to sign in to the application.
 *
 * @param redirect Optional redirect URL after successful sign-in.
 */
export function SignIn_Card({ redirect }: { redirect?: string }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Login to your account</CardTitle>
                <CardDescription>
                    Enter your email below to login to your account
                </CardDescription>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <EmailPasswordSignIn_Form redirect={redirect} />
                    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                        Or continue with
                    </FieldSeparator>
                    <SocialSignInButtons_Field />
                    <FieldDescription className="text-center">
                        Don't have an account?{" "}
                        <Link to={Paths.auth.signUp}>Sign Up</Link>
                    </FieldDescription>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

/**
 * Sign in form using email and password.
 *
 * @param redirect Optional redirect URL after successful sign-in.
 */
function EmailPasswordSignIn_Form({ redirect }: { redirect?: string }) {
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

    const [state, setState] = useState<
        | { status: "Ready" | "InProgress" }
        | { status: "Error"; error: { message?: string } }
    >({ status: "Ready" });

    // Handler for the sign-in form submission.
    const handleSignIn = form.handleSubmit(async (formData) => {
        setState({ status: "InProgress" });
        try {
            const { data, error } = await authClient.signIn.email(formData);

            if (error) {
                console.error("Sign in error", error);
                setState({ status: "Error", error });
            } else {
                console.log("Sign in successful", data);

                if (data.user.emailVerified) {
                    // Email is verfified
                    if (redirect) router.push(redirect);
                    else router.push(Paths.orgs.select.href);
                } else {
                    router.push(Paths.auth.verifyEmail(data.user.email).href);
                }
            }
        } catch (error) {
            console.error("Sign in error", error);
            toast.error("An error occured during sign in. Please try again.");
            setState({ status: "Ready" });
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
                            <Input
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

                            <Input
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
                    <Button
                        type="submit"
                        form="sign-in-form"
                        disabled={state.status == "InProgress"}
                    >
                        {state.status == "InProgress"
                            ? "Signing in..."
                            : "Login"}
                    </Button>
                </Field>
                {state.status == "Error" && (
                    <FieldError errors={[state.error]} />
                )}
            </FieldGroup>
        </form>
    );
}

/**
 * Social sign-In buttons field
 */
export function SocialSignInButtons_Field() {
    async function handleSignIn(provider: "apple" | "google" | "github") {
        try {
            const { data, error } = await authClient.signIn.social({
                provider,
                callbackURL: Paths.orgs.select.href,
            });

            if (error) {
                console.log("Social sign-in error", error);
                toast.error(`Social sign-in error: ${error.message}`);
            }
        } catch (error) {
            console.log("Social sign-in error", error);
            toast.error(
                "An error occured during social sign-in. Please try again.",
            );
        }
    }

    return (
        <Field className="grid grid-cols-3 gap-4">
            <Button
                variant="outline"
                type="button"
                onClick={() => handleSignIn("apple")}
                disabled
            >
                <SiApple />
                <span className="sr-only">Sign in with Apple</span>
            </Button>
            <Button
                variant="outline"
                type="button"
                onClick={() => handleSignIn("google")}
                disabled
            >
                <SiGoogle />
                <span className="sr-only">Sign in with Google</span>
            </Button>
            <Button
                variant="outline"
                type="button"
                onClick={() => handleSignIn("github")}
                disabled
            >
                <SiGithub />
                <span className="sr-only">Sign in with GitHub</span>
            </Button>
        </Field>
    );
}
