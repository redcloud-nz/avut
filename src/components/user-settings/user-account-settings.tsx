/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { Alert } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RainbowSpinner } from "@/components/ui/loading";

import { getUserInitials } from "@/lib/utils";
import { type AuthSession } from "@/server/auth";

export function UserAccountSettings() {
    const sessionQuery = authClient.useSession();
    // const [isMounted, setIsMounted] = useState(true);

    // useEffect(() => {
    //     setIsMounted(true);
    // }, []);

    // if (!isMounted) return <div className="h-10 w-10" />;

    if (sessionQuery.isPending) {
        return <RainbowSpinner className="mx-auto" />;
    }

    if (!sessionQuery.data) {
        return <Alert variant="error">No user data available</Alert>;
    }

    return (
        <div className="space-y-4">
            <UserProfile_Card session={sessionQuery.data} />
            <UserEmail_Card session={sessionQuery.data} />
        </div>
    );
}

function UserProfile_Card({ session }: { session: AuthSession }) {
    const form = useForm({
        resolver: zodResolver(z.object({ name: z.string().min(1).max(100) })),
        defaultValues: {
            name: session.user.name || "",
        },
    });

    const mutation = useMutation({
        async mutationFn(formData: { name: string }) {
            await authClient.updateUser({ name: formData.name });
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent>
                <form
                    id="update-profile-form"
                    onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                >
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Avatar</FieldLabel>
                            <div className="min-w-1/2">
                                <Avatar className="size-12 rounded-full">
                                    {session.user.image && (
                                        <AvatarImage src={session.user.image} alt="User Avatar" />
                                    )}
                                    <AvatarFallback className="rounded-full">
                                        {getUserInitials(session.user.name)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        </Field>
                        <Controller
                            control={form.control}
                            name="name"
                            render={({ field, fieldState }) => (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                                    <Input
                                        id={field.name}
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => form.reset()}>
                    Cancel
                </Button>
                <MutationButton
                    form="update-profile-form"
                    status={mutation.status}
                    text={{
                        idle: "Save",
                        pending: "Saving...",
                        success: "Saved!",
                    }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}

function UserEmail_Card({ session }: { session: AuthSession }) {
    const form = useForm({
        resolver: zodResolver(z.object({ email: z.email() })),
        defaultValues: {
            email: session.user.email || "",
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Change Email</CardTitle>
            </CardHeader>
            <CardContent>
                <form id="update-email-form">
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="email"
                            render={({ field, fieldState }) => (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="user-new-email">Email</FieldLabel>
                                    <Input
                                        id="user-new-email"
                                        type="email"
                                        disabled
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Alert variant="underConstruction">
                            Email change functionality is not implemented yet.
                        </Alert>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
