/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/--create
 */
"use client";

import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import {
    S2_Card,
    S2_CardContent,
    S2_CardDescription,
    S2_CardHeader,
    S2_CardTitle,
} from "../ui/s2-card";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { S2_Input } from "../ui/s2-input";

/**
 * Card for creating a new organization.
 */
export function CreateOrganization_Card() {
    const form = useForm({
        resolver: zodResolver(
            z.object({
                name: z.string().min(2).max(100).describe("Organization Name"),
                slug: z
                    .string()
                    .regex(/^[a-z0-9\-]+$/)
                    .min(2)
                    .max(50)
                    .describe("Organization Slug"),
            }),
        ),
    });

    return (
        <S2_Card>
            <S2_CardHeader>
                <S2_CardTitle>Create Organization</S2_CardTitle>
                <S2_CardDescription>
                    Use this form to create a new organization.
                </S2_CardDescription>
            </S2_CardHeader>
            <S2_CardContent>
                <form>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Organization Name</FieldLabel>
                                    <S2_Input {...field} />
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </S2_CardContent>
        </S2_Card>
    );
}
