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

import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
    ModifiableSkillGroup,
    SkillGroup,
    SkillGroupId,
} from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";

interface SkillPackageBuilder_Group_FormProps {
    formMode: "Create" | "Update";
    id: SkillGroupId;
    defaultValues: ModifiableSkillGroup;
    onSubmit: (formData: ModifiableSkillGroup) => void;
    skillPackage: SkillPackage;
}

export function SkillPackageBuilder_Group_Form(
    props: SkillPackageBuilder_Group_FormProps,
) {
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(SkillGroup.modifiableSchema),
        defaultValues: props.defaultValues,
    });

    return (
        <Card>
            <CardHeader>
                <Watch
                    control={form.control}
                    names={["name"]}
                    render={([name]) => (
                        <CardTitle>{name || "New Skill Group"}</CardTitle>
                    )}
                />
                <CardDescription>Skill Group</CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    id="skill-group-form"
                    onSubmit={form.handleSubmit(props.onSubmit)}
                >
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Group ID</FieldLabel>
                            <FieldValue value={props.id} format="id" />
                        </Field>
                        <Field orientation="responsive">
                            <FieldLabel>Package</FieldLabel>
                            <FieldValue value={props.skillPackage.name} />
                        </Field>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldLabel htmlFor="group-name">
                                        Name
                                    </FieldLabel>

                                    <Input
                                        id="group-name"
                                        autoFocus
                                        placeholder="New Skill Group"
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
                                    <FieldLabel htmlFor="group-description">
                                        Description
                                    </FieldLabel>

                                    <Textarea
                                        id="group-description"
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
                            <Button type="submit" form="skill-group-form">
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
