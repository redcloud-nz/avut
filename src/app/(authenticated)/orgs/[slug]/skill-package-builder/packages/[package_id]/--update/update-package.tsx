/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import { SkillPackage } from "@/lib/schemas/skill-package";

interface SkillPackageBuilder_UpdatePackage_FormProps {
    skillPackage: SkillPackage;
}

export function SkillPackageBuilder_UpdatePackage_Form({
    skillPackage,
}: SkillPackageBuilder_UpdatePackage_FormProps) {
    const organization = useOrganization();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(SkillPackage.modifiableSchema),
        defaultValues: skillPackage,
    });

    const handleSubmit = form.handleSubmit((formData) => {
        toast.promise(
            async () => {
                router.back();

                const collection = getSkillPackagesCollection(organization.id);
                const tx = collection.update(skillPackage.id, (draft) => {
                    draft.name = formData.name;
                    draft.description = formData.description;
                    draft.tags = formData.tags;
                    draft.properties = formData.properties;
                });

                await tx.isPersisted.promise;
            },
            {
                loading: "Updating skill package...",
                success: "Skill package updated",
                error: (error) =>
                    `Failed to update skill package: ${error.message}`,
            },
        );
    });

    return (
        <Card>
            <CardHeader>
                <Watch
                    control={form.control}
                    names={["name"]}
                    render={([name]) => <CardTitle>{name}</CardTitle>}
                />
                <CardDescription>Skill Package</CardDescription>
            </CardHeader>
            <CardContent>
                <form id="update-skill-package-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Package ID</FieldLabel>
                            <FieldValue
                                value={skillPackage.id}
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
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id="package-name"
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
                                        Description
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
                            <Button
                                type="submit"
                                form="update-skill-package-form"
                            >
                                Update
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    form.reset();
                                    router.back();
                                }}
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
