/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { SocialSignInButtons_Field } from "@/components/auth/sign-in";
import { MutationButton } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { authUrl } from "@/lib/auth-redirect";
import { route } from "@/lib/routes";
import type { InvitationId } from "@/lib/schemas/organization-invitation";
import { trpc } from "@/trpc/client";

/**
 * Signs an existing account in from the invitation landing page, so the person never leaves it:
 * password, or Google/GitHub. The invited address goes to the provider as a login hint, which
 * Google honours and GitHub ignores.
 *
 * On success the landing page re-renders with Accept/Decline. An account that never verified its
 * email is sent a code and continues through the verify-email page, which returns here.
 *
 * @param invitationId The invitation from the link.
 * @param email The address the invitation was sent to (shown, not editable).
 */
export function InvitationSignIn_Form({
    invitationId,
    email,
}: {
    invitationId: InvitationId;
    email: string;
}) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const returnTo = route("/invitations/[invitation_id]", { invitation_id: invitationId });

    const form = useForm({
        resolver: zodResolver(z.object({ password: z.string().min(1, "Password is required.") })),
        defaultValues: { password: "" },
    });

    const mutation = useMutation({
        async mutationFn({ password }: { password: string }) {
            const { error } = await authClient.signIn.email({ email, password });

            if (error?.code === "EMAIL_NOT_VERIFIED") {
                // Nothing sends this code on an unverified sign-in, so it has to be requested here.
                await authClient.emailOtp.sendVerificationOtp({
                    email,
                    type: "email-verification",
                });
                return { verified: false };
            }
            if (error) throw new Error(error.message ?? "Invalid email or password.");

            return { verified: true };
        },
        onSuccess({ verified }) {
            if (verified) {
                // The session cookie changed: drop the cached copies that were fetched signed
                // out, and re-render the server tree that reads it.
                void queryClient.invalidateQueries(trpc.user.getSession.queryFilter());
                void queryClient.invalidateQueries(
                    trpc.invitations.getLanding.queryFilter({ invitationId }),
                );
                router.refresh();
            } else {
                router.push(
                    authUrl(
                        route("/auth/verify-email/[email]", { email: encodeURIComponent(email) }),
                        { returnTo },
                    ),
                );
            }
        },
    });

    return (
        <FieldGroup>
            <form
                id="invitation-sign-in-form"
                onSubmit={form.handleSubmit(({ password }) => mutation.mutate({ password }))}
            >
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="invitation-sign-in-email">Email Address</FieldLabel>
                        <Input
                            id="invitation-sign-in-email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            readOnly
                        />
                    </Field>
                    <Controller
                        name="password"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <div className="flex items-center">
                                    <FieldLabel htmlFor="invitation-sign-in-password">
                                        Password
                                    </FieldLabel>
                                    <Link
                                        href={authUrl("/auth/forgot-password", { email, returnTo })}
                                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <PasswordInput
                                    id="invitation-sign-in-password"
                                    autoComplete="current-password"
                                    placeholder="Your password"
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
                            form="invitation-sign-in-form"
                            status={mutation.status}
                            text={{
                                idle: "Sign in",
                                pending: "Signing in...",
                                success: "Signing in...",
                            }}
                        />
                        {mutation.isError && <FieldError errors={[mutation.error]} />}
                    </Field>
                </FieldGroup>
            </form>
            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
            </FieldSeparator>
            <SocialSignInButtons_Field redirectTo={returnTo} loginHint={email} />
        </FieldGroup>
    );
}
