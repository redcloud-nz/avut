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
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";

import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";

import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface SkillPackageBuilder_CreateGroup_FormProps {
    skillPackage: SkillPackage;
}

export default function SkillPackageBuilder_CreateGroup_Form({
    skillPackage,
}: SkillPackageBuilder_CreateGroup_FormProps) {
    const organization = useOrganization();
    const router = useRouter();

    const groupId = useMemo(() => SkillGroupId.create(), []);

    const form = useForm({
        resolver: zodResolver(SkillGroup.modifiableSchema),
        defaultValues: {
            name: "",
            description: "",
            tags: [],
            properties: {},
        },
    });

    const handleCreate = form.handleSubmit((formData) => {
        toast.promise(
            async () => {
                const collection = getSkillGroupsCollection(organization.id);
                const tx = collection.insert({
                    id: groupId,
                    skillPackageId: skillPackage.id,
                    parentGroupId: null,
                    ...formData,
                    sequence: 0,
                    status: "Active",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                await new Promise((resolve) => setTimeout(resolve, 100));

                router.push(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(skillPackage.id)
                        .group(groupId).href,
                );

                await tx.isPersisted.promise;
            },
            {
                loading: "Creating the skill group...",
                success: "Skill group created!",
                error: (error) =>
                    `Failed to create the skill group: ${error.message}`,
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
                        <CardTitle>{name || "New Skill Group"}</CardTitle>
                    )}
                />
                <CardDescription>Skill Group</CardDescription>
            </CardHeader>
            <CardContent>
                <form id="create-group-form" onSubmit={handleCreate}>
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Group ID</FieldLabel>
                            <FieldValue value={groupId} format="id" />
                        </Field>
                        <Field orientation="responsive">
                            <FieldLabel>Package</FieldLabel>
                            <FieldValue value={skillPackage.name} />
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
                            <Button type="submit" form="create-group-form">
                                Create
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
