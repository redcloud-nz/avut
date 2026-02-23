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
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";

interface SkillPackageBuilder_UpdateGroup_FormProps {
    skillGroup: SkillGroup & { skillPackage: SkillPackage };
}

export function SkillPackageBuilder_UpdateGroup_Form({
    skillGroup,
}: SkillPackageBuilder_UpdateGroup_FormProps) {
    const organization = useOrganization();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(SkillGroup.modifiableSchema),
        defaultValues: skillGroup,
    });

    const handleSubmit = form.handleSubmit((formData) => {
        toast.promise(
            async () => {
                router.back();

                const collection = getSkillGroupsCollection(organization.id);
                const tx = collection.update(skillGroup.id, (draft) => {
                    draft.name = formData.name;
                    draft.description = formData.description;
                    draft.tags = formData.tags;
                    draft.properties = formData.properties;
                });

                await tx.isPersisted.promise;
            },
            {
                loading: "Updating Skill Group...",
                success: "Skill Group updated",
                error: (error) =>
                    `Failed to update Skill Group: ${error.message}`,
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
                <CardDescription>Skill Group</CardDescription>
            </CardHeader>
            <CardContent>
                <form id="update-skill-group-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Group ID</FieldLabel>
                            <FieldValue value={skillGroup.id} format="id" />
                        </Field>
                        <Field orientation="responsive">
                            <FieldLabel>Package</FieldLabel>
                            <FieldValue value={skillGroup.skillPackage.name} />
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
                            <Button
                                type="submit"
                                form="update-skill-group-form"
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
