/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm, Watch } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";

import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

export function SkillPackageBuilder_CreatePackage_Form() {
    const organization = useOrganization();
    const router = useRouter();

    const packageId = useMemo(() => SkillPackageId.create(), []);

    const form = useForm({
        resolver: zodResolver(SkillPackage.modifiableSchema),
        defaultValues: {
            name: "",
            description: "",
            tags: [],
            properties: {},
            status: "Active",
        },
    });

    const handleCreate = form.handleSubmit((formData) => {
        toast.promise(
            async () => {
                router.push(
                    Paths.org(
                        organization.slug,
                    ).skillPackageBuilder.skillPackage(packageId).index.href,
                );

                const collection = getSkillPackagesCollection(organization.id);
                const tx = collection.insert({
                    id: packageId,
                    ...formData,
                    status: "Active",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                await tx.isPersisted.promise;
            },
            {
                loading: "Creating skill package...",
                success: "Skill package created!",
                error: (error) =>
                    `Failed to create skill package: ${error.message}`,
            },
        );
    });

    return (
        <Card>
            <CardHeader>
                <Watch
                    control={form.control}
                    names={["name"]}
                    render={([name]) => (
                        <CardTitle>{name || "New Skill Package"}</CardTitle>
                    )}
                />
                <CardDescription>Skill Package</CardDescription>
            </CardHeader>
            <CardContent>
                <form id="create-package-form" onSubmit={handleCreate}>
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel htmlFor="package-id">
                                Package ID
                            </FieldLabel>
                            <FieldValue
                                value={packageId}
                                format="id"
                                className="min-w-1/2"
                            />
                        </Field>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldLabel htmlFor="package-name">
                                        Package Name
                                    </FieldLabel>

                                    <Input
                                        id="package-name"
                                        placeholder="New Skill Package"
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                        {...field}
                                    />
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="description"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldLabel htmlFor="package-description">
                                        Package Description
                                    </FieldLabel>

                                    <Textarea
                                        id="package-description"
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                        {...field}
                                    />
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Field orientation="horizontal">
                            <Button type="submit" form="create-package-form">
                                Create
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    form.reset();
                                    router.back();
                                }}
                                asChild
                            >
                                Cancel
                            </Button>
                        </Field>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
