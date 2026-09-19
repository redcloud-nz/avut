/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { MutationButton } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

import { invitationsEffects } from "@/client/invitations-effects";
import type { InvitationId } from "@/lib/schemas/organization-invitation";
import { ConfirmPasswordSchema, PasswordSchema } from "@/lib/schemas/password";
import { trpc } from "@/trpc/client";

/**
 * Creates an account for the invited address without the emailed verification code — following
 * the invitation link already proved the person owns the mailbox. The email is fixed: the server
 * takes it from the invitation, so this only ever sends the id, a name and a password.
 *
 * On success the new account is signed in and the landing page re-renders with Accept/Decline.
 *
 * @param invitationId The invitation from the link.
 * @param email The address the invitation was sent to (shown, not editable).
 * @param name Optional name to pre-fill, from the invitation's personnel record.
 */
export function InvitationSignUp_Form({
    invitationId,
    email,
    name,
}: {
    invitationId: InvitationId;
    email: string;
    name?: string | null;
}) {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z
                .object({
                    name: z.string().min(2, "Name is required."),
                    password: PasswordSchema,
                    confirmPassword: ConfirmPasswordSchema,
                })
                .refine((data) => data.password === data.confirmPassword, {
                    message: "Passwords do not match",
                    path: ["confirmPassword"],
                }),
        ),
        defaultValues: { name: name ?? "", password: "", confirmPassword: "" },
    });

    const mutation = useMutation(
        trpc.invitations.signUp.mutationOptions({
            meta: { effects: invitationsEffects.signUp },
            onSuccess() {
                // The session cookie changed; re-render the server tree that reads it.
                router.refresh();
            },
        }),
    );

    return (
        <form
            id="invitation-sign-up-form"
            onSubmit={form.handleSubmit(({ name, password }) =>
                mutation.mutate({ invitationId, name, password }),
            )}
        >
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="invitation-sign-up-email">Email Address</FieldLabel>
                    <Input id="invitation-sign-up-email" type="email" value={email} readOnly />
                    <FieldDescription>
                        You&apos;re verified by following the link we emailed you.
                    </FieldDescription>
                </Field>
                <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="invitation-sign-up-name">Name</FieldLabel>
                            <Input
                                id="invitation-sign-up-name"
                                placeholder="Your full name"
                                autoComplete="name"
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
                            <FieldLabel htmlFor="invitation-sign-up-password">Password</FieldLabel>
                            <PasswordInput
                                id="invitation-sign-up-password"
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
                            <FieldLabel htmlFor="invitation-sign-up-confirm-password">
                                Confirm Password
                            </FieldLabel>
                            <PasswordInput
                                id="invitation-sign-up-confirm-password"
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
                        form="invitation-sign-up-form"
                        status={mutation.status}
                        text={{
                            idle: "Create account",
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
