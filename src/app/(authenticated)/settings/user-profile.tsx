/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

"use client";

import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";

import { authQueries } from "@/client/auth-queries";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function UserProfile_Card() {
    const sessionQuery = useSuspenseQuery(authQueries.session);

    const form = useForm({
        resolver: zodResolver(z.object({ name: z.string().min(1).max(100) })),
        defaultValues: {
            name: sessionQuery.data?.user?.name || "",
        },
    });

    if (!sessionQuery.data) {
        return <Alert variant="error">No user data available</Alert>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Controller
                        control={form.control}
                        name="name"
                        render={({ field, fieldState }) => (
                            <Field>
                                <FieldLabel>Name</FieldLabel>
                                <Input {...field} />
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Field orientation="horizontal">
                        <Button>Save changes</Button>
                    </Field>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}
