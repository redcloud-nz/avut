/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/--create
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "../ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

import { authClient } from "@/lib/auth-client";
import * as Paths from "@/paths";

/**
 * Card for creating a new organization.
 */
export function CreateOrganization_Card() {
    const router = useRouter();

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

    const [slugCheckStatus, setSlugCheckStatus] = useState<
        "Ready" | "Checking" | "Available" | "Unavailable"
    >("Ready");

    /**
     * Check the availability of the given slug, setting the slug check status accordingly.
     * @param slug The slug to check.
     */
    async function handleCheckSlugAvailability(slug: string) {
        if (slug.length == 0) return;

        setSlugCheckStatus("Checking");
        try {
            const { data, error } = await authClient.organization.checkSlug({
                slug,
            });

            if (error) {
                toast.error(
                    "Failed to check slug availability. " + error.message,
                );
                setSlugCheckStatus("Ready");
            } else {
                setSlugCheckStatus(data.status ? "Available" : "Unavailable");
                if (!data.status) {
                    form.setError("slug", {
                        type: "custom",
                        message: "Slug is already taken.",
                    });
                }
            }
        } catch (error) {
            toast.error("Failed to check slug availability.");
            setSlugCheckStatus("Ready");
            return;
        }
    }

    const handleSubmit = form.handleSubmit(async (formData) => {
        try {
            const { data, error } = await authClient.organization.create({
                name: formData.name,
                slug: formData.slug,
            });

            if (error) {
                console.error("Organization creation error:", error);
                toast.error("Failed to create organization. " + error.message);
            } else {
                console.log("Organization created", data);
                toast.success("Organization created successfully.");
                router.push(Paths.main(data.slug).index.href);
            }
        } catch (error) {
            console.error("Organization creation error:", error);
            toast.error("Failed to create organization.");
        }
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Create Organization</CardTitle>
                <CardDescription>
                    Use this form to create a new organization.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form id="create-organization-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="name">
                                        Organization Name
                                    </FieldLabel>
                                    <Input id={"name"} {...field} />
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="slug"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="slug">Slug</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput
                                            id="slug"
                                            value={field.value}
                                            onChange={(ev) => {
                                                const value = ev.target.value
                                                    .toLowerCase()
                                                    .replace(/\s+/g, "-")
                                                    .replace(
                                                        /[^a-z0-9\-]/g,
                                                        "",
                                                    );
                                                field.onChange(value);
                                                setSlugCheckStatus("Ready");
                                            }}
                                            onBlur={() =>
                                                handleCheckSlugAvailability(
                                                    field.value,
                                                )
                                            }
                                        />
                                        <InputGroupAddon align="inline-end">
                                            {slugCheckStatus === "Checking" && (
                                                <Spinner />
                                            )}
                                            {slugCheckStatus ===
                                                "Available" && (
                                                <span className="text-green-600">
                                                    Available
                                                </span>
                                            )}
                                            {slugCheckStatus ===
                                                "Unavailable" && (
                                                <span className="text-red-600">
                                                    Unavailable
                                                </span>
                                            )}
                                        </InputGroupAddon>
                                    </InputGroup>
                                    <FieldDescription>
                                        The uniquer identifier for your
                                        organization for use in URLs. Lowercase
                                        letters, numbers, and hyphens only.
                                    </FieldDescription>
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Field>
                            <Button
                                type="submit"
                                form="create-organization-form"
                            >
                                Create Organization
                            </Button>
                        </Field>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
