/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Link2Icon, Link2OffIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { SiApple, SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";
import { useMutation, useQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { Alert } from "@/components/ui/alert";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";
import { RainbowSpinner } from "@/components/ui/loading";
import { PasswordInput } from "@/components/ui/password-input";

export function UserSecuritySettings() {
    const accountsQuery = useQuery({
        queryFn: () => authClient.listAccounts({}, { throw: true }),
        queryKey: ["user", "linkedAccounts"],
    });

    if (accountsQuery.isPending) {
        return (
            <div className="p-4">
                <RainbowSpinner className="mx-auto" />
            </div>
        );
    }
    if (accountsQuery.isError) {
        return (
            <Alert variant="error">
                Failed to load linked accounts: {accountsQuery.error.message}
            </Alert>
        );
    }

    const hasCredentialAccount = accountsQuery.data.some(
        (account) => account.providerId === "credentials",
    );

    return (
        <div className="space-y-4">
            {hasCredentialAccount ? <ChangePassword_Card /> : <SetPassword_Card />}
            {/* <LinkedAccounts_Card
                linkedAccounts={accountsQuery.data.map((account) => account.providerId)}
            /> */}
        </div>
    );
}

function SetPassword_Card() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Set Password</CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="warning">
                    You are currently signed in with a third-party provider and do not have a
                    password set.
                </Alert>
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
    });

    const mutation = useMutation({
        async mutationFn(formData: {
            currentPassword: string;
            newPassword: string;
            revokeOtherSessions: boolean;
        }) {
            await authClient.changePassword({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword,
                revokeOtherSessions: formData.revokeOtherSessions,
            });
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
                        <Field orientation="horizontal">
                            <MutationButton
                                form="change-password-form"
                                status={mutation.status}
                                text={{
                                    idle: "Change Password",
                                    pending: "Changing...",
                                    success: "Password Changed!",
                                }}
                                disabled={mutation.status !== "idle"}
                            />
                        </Field>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LinkedAccounts_Card({ linkedAccounts }: { linkedAccounts: string[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Linked Accounts</CardTitle>
            </CardHeader>
            <CardContent>
                <LinkedAccount providerId="github" isLinked={linkedAccounts.includes("github")} />
                <LinkedAccount providerId="google" isLinked={linkedAccounts.includes("google")} />
            </CardContent>
        </Card>
    );
}

const providerIcons = {
    github: SiGithub,
    google: SiGoogle,
    apple: SiApple,
};

function LinkedAccount({
    providerId,
    isLinked,
}: {
    providerId: "github" | "google" | "apple";
    isLinked: boolean;
}) {
    const IconComponent = providerIcons[providerId];

    return (
        <Item>
            <ItemMedia>
                <IconComponent />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>{providerId.charAt(0).toUpperCase() + providerId.slice(1)}</ItemTitle>
                <ItemDescription>
                    {isLinked
                        ? "Linked"
                        : `Link your ${providerId.charAt(0).toUpperCase() + providerId.slice(1)} account`}
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                {isLinked ? (
                    <Button variant="outline">
                        <Link2OffIcon /> Unlink
                    </Button>
                ) : (
                    <Button variant="outline">
                        <Link2Icon /> Link
                    </Button>
                )}
            </ItemActions>
        </Item>
    );
}
