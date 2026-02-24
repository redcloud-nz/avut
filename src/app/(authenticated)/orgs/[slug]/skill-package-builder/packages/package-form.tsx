/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, Watch } from "react-hook-form";
import { match } from "ts-pattern";

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

import {
    ModifiableSkillPackage,
    SkillPackage,
    SkillPackageId,
} from "@/lib/schemas/skill-package";

interface SkillPackageBuilder_Package_FormProps {
    formMode: "Create" | "Update";
    defaultValues: ModifiableSkillPackage & { id: SkillPackageId };
    onSubmit: (updatedPackage: ModifiableSkillPackage) => void;
}

/**
 * Form component for creating and updating skill packages. Renders a form with fields for name and description.
 * @param props - The props for the form component, including form mode, default values, and submit handler.
 */
export function SkillPackageBuilder_Package_Form(
    props: SkillPackageBuilder_Package_FormProps,
) {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(SkillPackage.modifiableSchema),
        defaultValues: props.defaultValues,
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
                <form
                    id="skill-package-form"
                    onSubmit={form.handleSubmit(props.onSubmit)}
                >
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Package ID</FieldLabel>
                            <FieldValue
                                value={props.defaultValues.id}
                                format="id"
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
                                        autoFocus
                                        aria-invalid={fieldState.invalid}
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
                            <Button type="submit" form="skill-package-form">
                                {match(props.formMode)
                                    .with("Create", () => "Create")
                                    .with("Update", () => "Update")
                                    .exhaustive()}
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
