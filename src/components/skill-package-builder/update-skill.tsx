/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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

import { skillPackageBuilderInvalidations } from "@/client/skill-package-builder-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { ModifiableSkill, Skill } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_UpdateSkill_Dialog({
    skill,
}: {
    skill: Skill & { skillGroup: SkillGroup; skillPackage: SkillPackage };
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [dialogOpen, setDialogOpen] = useState(false);

    const form = useForm({
        resolver: zodResolver(Skill.modifiableSchema),
        defaultValues: skill,
    });

    const mutation = useMutation(
        trpc.skillPackageBuilder.updateSkill.mutationOptions({
            meta: { invalidates: skillPackageBuilderInvalidations.updateSkill },
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(error.shape.cause.message as keyof ModifiableSkill, {
                        message: error.message,
                    });
                } else {
                    toast.error(`Failed to update skill: ${error.message}`);
                    console.error("Failed to update skill:", error);
                }
            },
            onSuccess({ updated }) {
                toast.success("Skill updated successfully");

                handleOpenChange(false);

                queryClient.setQueryData(
                    trpc.skillPackageBuilder.getSkill.queryKey({
                        organizationId: organization.id,
                        skillId: skill.id,
                    }),
                    { ...updated, skillGroup: skill.skillGroup, skillPackage: skill.skillPackage },
                );
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }
        setDialogOpen(open);
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update skill</DialogTitle>
                    <DialogDescription>Update the details of this skill.</DialogDescription>
                </DialogHeader>
                <form
                    id="update-skill-form"
                    onSubmit={form.handleSubmit((formData) =>
                        mutation.mutate({
                            skillId: skill.id,
                            organizationId: organization.id,
                            update: formData,
                        }),
                    )}
                >
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Skill ID</FieldLabel>
                            <FieldValue value={skill.id} format="id" />
                        </Field>
                        <Field>
                            <FieldLabel>Package</FieldLabel>
                            <FieldValue value={skill.skillPackage.name} />
                        </Field>
                        <Field>
                            <FieldLabel>Group</FieldLabel>
                            <FieldValue value={skill.skillGroup.name} />
                        </Field>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="skill-name">Name</FieldLabel>
                                    <Input
                                        id="skill-name"
                                        autoFocus
                                        placeholder="Skill Name"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="description"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="skill-description">Description</FieldLabel>
                                    <Textarea
                                        id="skill-description"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="defaultRequired"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldContent>
                                        <FieldLabel htmlFor="default-required">Required</FieldLabel>
                                        <FieldDescription>
                                            Whether this skill is required by default.
                                        </FieldDescription>
                                    </FieldContent>
                                    <Select
                                        value={field.value ? "true" : "false"}
                                        onValueChange={(value) => field.onChange(value === "true")}
                                    >
                                        <SelectTrigger
                                            id="default-required"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">Yes</SelectItem>
                                            <SelectItem value="false">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="frequency"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldContent>
                                        <FieldLabel htmlFor="frequency">
                                            Revalidation Frequency
                                        </FieldLabel>
                                        <FieldDescription>
                                            How often this skill should be revalidated.
                                        </FieldDescription>
                                    </FieldContent>
                                    <InputGroup aria-invalid={fieldState.invalid}>
                                        <InputGroupInput
                                            id="frequency"
                                            type="number"
                                            min={1}
                                            max={48}
                                            value={field.value}
                                            onChange={(ev) =>
                                                field.onChange(parseInt(ev.currentTarget.value))
                                            }
                                        />
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText>months</InputGroupText>
                                        </InputGroupAddon>
                                    </InputGroup>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-skill-form"
                        status={mutation.status}
                        text={{
                            idle: "Update",
                            pending: "Updating...",
                            success: "Updated",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
