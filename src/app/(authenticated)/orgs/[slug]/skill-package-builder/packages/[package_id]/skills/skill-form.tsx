/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, Watch } from "react-hook-form";
import { P, match } from "ts-pattern";

import { zodResolver } from "@hookform/resolvers/zod";
import { eq, useLiveQuery } from "@tanstack/react-db";

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
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { ModifiableSkill, Skill, SkillId } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";

interface SkillPackageBuilder_Skill_FormProps {
    formMode: "Create" | "Update";
    id: SkillId;
    defaultValues: ModifiableSkill;
    onSubmit: (updatedSkill: ModifiableSkill) => void;
    skillPackage: SkillPackage;
    skillGroup: SkillGroup | null;
}

export function SkillPackageBuilder_Skill_Form(
    props: SkillPackageBuilder_Skill_FormProps,
) {
    const organization = useOrganization();
    const router = useRouter();

    const { data: skillGroups } = useLiveQuery((q) =>
        q
            .from({ skillGroup: getSkillGroupsCollection(organization.id) })
            .where(({ skillGroup }) =>
                eq(skillGroup.skillPackageId, props.skillPackage.id),
            ),
    );

    const form = useForm({
        resolver: zodResolver(Skill.modifiableSchema),
        defaultValues: {
            ...props.defaultValues,
            skillGroupId: props.skillGroup?.id ?? null,
        },
    });

    return (
        <Card>
            <CardHeader>
                <Watch
                    control={form.control}
                    names={["name"]}
                    render={([name]) => (
                        <CardTitle>{name || "New Skill"}</CardTitle>
                    )}
                />
                <CardDescription>Skill</CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    id="skill-form"
                    onSubmit={form.handleSubmit(props.onSubmit)}
                >
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Skill ID</FieldLabel>
                            <FieldValue value={props.id} format="id" />
                        </Field>
                        <Field orientation="responsive">
                            <FieldLabel>Package</FieldLabel>
                            <FieldValue value={props.skillPackage.name} />
                        </Field>

                        {match(props)
                            .with(
                                { skillGroup: P.not(null) },
                                ({ skillGroup }) => (
                                    <Field orientation="responsive">
                                        <FieldLabel>Group</FieldLabel>
                                        <FieldValue value={skillGroup.name} />
                                    </Field>
                                ),
                            )
                            .with(
                                // In create mode, allow selecting a skill group. In update mode, if there is no skill group, show "None".
                                { formMode: "Create", skillGroup: null },
                                () => (
                                    <Controller
                                        name="skillGroupId"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                                orientation="responsive"
                                            >
                                                <FieldLabel htmlFor="skill-group">
                                                    Group
                                                </FieldLabel>

                                                <Select
                                                    value={field.value ?? ""}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="group-id"
                                                        aria-invalid={
                                                            fieldState.invalid
                                                        }
                                                    >
                                                        <SelectValue placeholder="Select a group..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {skillGroups.map(
                                                            (group) => (
                                                                <SelectItem
                                                                    key={
                                                                        group.id
                                                                    }
                                                                    value={
                                                                        group.id
                                                                    }
                                                                >
                                                                    {group.name}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                {fieldState.error && (
                                                    <FieldError
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
                                                    />
                                                )}
                                            </Field>
                                        )}
                                    />
                                ),
                            )
                            .with(
                                { formMode: "Update", skillGroup: null },
                                () => (
                                    <Field orientation="responsive">
                                        <FieldLabel>Group</FieldLabel>
                                        <FieldValue empty />
                                    </Field>
                                ),
                            )
                            .exhaustive()}

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
                                        autoFocus
                                        placeholder="Skill Name"
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
                            <Button type="submit" form="skill-form">
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
