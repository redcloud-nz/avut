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
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillsCollection } from "@/lib/collections/skills";
import { Skill } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";

interface SkillPackageBuilder_UpdateSkill_FormProps {
    skill: Skill & {
        skillGroup: SkillGroup | undefined;
        skillPackage: SkillPackage;
    };
}

export function SkillPackageBuilder_UpdateSkill_Form({
    skill,
}: SkillPackageBuilder_UpdateSkill_FormProps) {
    const organization = useOrganization();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(Skill.modifiableSchema),
        defaultValues: skill,
    });

    const handleSubmit = form.handleSubmit((formData) => {
        toast.promise(
            async () => {
                router.back();

                const collection = getSkillsCollection(organization.id);
                const tx = collection.update(skill.id, (draft) => {
                    draft.name = formData.name;
                    draft.description = formData.description;
                    draft.tags = formData.tags;
                    draft.properties = formData.properties;
                    draft.defaultRequired = formData.defaultRequired;
                    draft.frequency = formData.frequency;
                });

                await tx.isPersisted.promise;
            },
            {
                loading: "Updating Skill...",
                success: "Skill updated",
                error: (error) => `Failed to update Skill: ${error.message}`,
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
                <CardDescription>Skill</CardDescription>
            </CardHeader>
            <CardContent>
                <form id="update-skill-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Skill ID</FieldLabel>
                            <FieldValue value={skill.id} format="id" />
                        </Field>
                        <Field orientation="responsive">
                            <FieldLabel>Package</FieldLabel>
                            <FieldValue value={skill.skillPackage.name} />
                        </Field>
                        <Field orientation="responsive">
                            <FieldLabel>Group</FieldLabel>
                            <FieldValue value={skill.skillGroup?.name ?? ""} />
                        </Field>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldLabel htmlFor="skill-name">
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id="skill-name"
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
                                    <FieldLabel htmlFor="skill-description">
                                        Description
                                    </FieldLabel>
                                    <Textarea
                                        id="skill-description"
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
                            name="defaultRequired"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    orientation="responsive"
                                    data-invalid={fieldState.invalid}
                                >
                                    <FieldContent>
                                        <FieldLabel htmlFor="default-required">
                                            Required
                                        </FieldLabel>
                                        <FieldDescription>
                                            Whether this skill is required by
                                            default.
                                        </FieldDescription>
                                    </FieldContent>
                                    <Select
                                        value={field.value ? "true" : "false"}
                                        onValueChange={(value) =>
                                            field.onChange(value === "true")
                                        }
                                    >
                                        <SelectTrigger
                                            id="default-required"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">
                                                Yes
                                            </SelectItem>
                                            <SelectItem value="false">
                                                No
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="frequency"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldContent>
                                        <FieldLabel htmlFor="frequency">
                                            Revalidation Frequency
                                        </FieldLabel>
                                        <FieldDescription>
                                            How often this skill should be
                                            revalidated.
                                        </FieldDescription>
                                    </FieldContent>

                                    <InputGroup
                                        aria-invalid={fieldState.invalid}
                                    >
                                        <InputGroupInput
                                            id="frequency"
                                            type="number"
                                            min={1}
                                            max={48}
                                            value={field.value}
                                            onChange={(ev) =>
                                                field.onChange(
                                                    parseInt(
                                                        ev.currentTarget.value,
                                                    ),
                                                )
                                            }
                                        />
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText>
                                                months
                                            </InputGroupText>
                                        </InputGroupAddon>
                                    </InputGroup>
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Field orientation="horizontal">
                            <Button type="submit" form="update-skill-form">
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
