/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

import { authClient } from "@/client/auth-client";
import { authUrl, SIGN_IN_PATH, VERIFY_EMAIL_PATH } from "@/lib/auth-redirect";
import { ConfirmPasswordSchema, PasswordSchema } from "@/lib/schemas/password";

import { SocialSignInButtons_Field } from "./sign-in";

/**
 *
 * @param email Optional email to pre-fill in the form.
 * @param name Optional name to pre-fill in the form.
 * @param redirectTo Optional path to return to once the account is verified and signed in.
 */
export function SignUp_Card({
    email,
    name,
    redirectTo,
}: {
    email?: string;
    name?: string;
    redirectTo?: string;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>Enter your details to sign up.</CardDescription>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Auth_EmailPasswordSignUp_Form
                        email={email}
                        name={name}
                        redirectTo={redirectTo}
                    />

                    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                        Or continue with
                    </FieldSeparator>

                    <SocialSignInButtons_Field redirectTo={redirectTo} />

                    <FieldDescription className="text-center">
                        Already have an account?{" "}
                        <Link href={authUrl(SIGN_IN_PATH, { email, returnTo: redirectTo })}>
                            Sign in
                        </Link>
                    </FieldDescription>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

/**
 * Form form signing up with email and password.
 */
function Auth_EmailPasswordSignUp_Form({
    email,
    name,
    redirectTo,
}: {
    email?: string;
    name?: string;
    redirectTo?: string;
}) {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z
                .object({
                    name: z.string().min(2, "Name is required."),
                    email: z.email("Invalid email address"),
                    password: PasswordSchema,
                    confirmPassword: ConfirmPasswordSchema,
                })
                .refine((data) => data.password === data.confirmPassword, {
                    message: "Passwords do not match",
                    path: ["confirmPassword"],
                }),
        ),
        defaultValues: {
            name: name || "",
            email: email || "",
            password: "",
            confirmPassword: "",
        },
    });

    const mutation = useMutation({
        async mutationFn(formData: { name: string; email: string; password: string }) {
            const { data, error } = await authClient.signUp.email(formData);
            if (error) {
                throw new Error(error.message ?? "Unable to create account.");
            }
            return data;
        },
        onSuccess(_, variables) {
            router.push(
                authUrl(`${VERIFY_EMAIL_PATH}/${encodeURIComponent(variables.email)}`, {
                    returnTo: redirectTo,
                }),
            );
        },
    });

    return (
        <form
            id="sign-up-form"
            onSubmit={form.handleSubmit(({ confirmPassword: _confirmPassword, ...data }) =>
                mutation.mutate(data),
            )}
        >
            <FieldGroup>
                <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="sign-up-name">Name</FieldLabel>
                            <Input
                                id="sign-up-name"
                                placeholder="Your full name"
                                aria-invalid={fieldState.invalid}
                                disabled={mutation.isPending}
                                {...field}
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="email">Email Address</FieldLabel>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Your email address"
                                aria-invalid={fieldState.invalid}
                                disabled={mutation.isPending}
                                {...field}
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
                <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
                            <PasswordInput
                                id="sign-up-password"
                                autoComplete="new-password"
                                placeholder="Your password"
                                aria-invalid={fieldState.invalid}
                                disabled={mutation.isPending}
                                {...field}
                            />
                            <FieldDescription>Must be at least 8 characters long.</FieldDescription>
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
                <Controller
                    name="confirmPassword"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="sign-up-confirm-password">
                                Confirm Password
                            </FieldLabel>
                            <PasswordInput
                                id="sign-up-confirm-password"
                                autoComplete="new-password"
                                placeholder="Enter your password again"
                                aria-invalid={fieldState.invalid}
                                disabled={mutation.isPending}
                                {...field}
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
                <Field>
                    <MutationButton
                        type="submit"
                        form="sign-up-form"
                        status={mutation.status}
                        text={{
                            idle: "Sign Up",
                            pending: "Creating account...",
                            success: "Account created!",
                        }}
                    />
                    {mutation.isError && <FieldError errors={[mutation.error]} />}
                </Field>
            </FieldGroup>
        </form>
    );
}
