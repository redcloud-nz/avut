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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { getUserInitials } from "@/lib/utils";
import { type AuthSession } from "@/server/auth";

export function UserProfile_Card({ session }: { session: AuthSession }) {
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
                {form.formState.isDirty && (
                    <Button variant="ghost" onClick={() => form.reset()}>
                        Reset
                    </Button>
                )}
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
