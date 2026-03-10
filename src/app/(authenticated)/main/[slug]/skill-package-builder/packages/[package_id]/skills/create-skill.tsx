/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { ModifiableSkill, Skill, SkillId } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_CreateSkill_Dialog({
    skillGroup,
    skillPackage,
    ...props
}: DialogProps & { skillGroup: SkillGroup; skillPackage: SkillPackage }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(Skill.modifiableSchema),
        defaultValues: {
            name: "",
            description: "",
            tags: [],
            properties: {},
            frequency: 12,
        },
    });

    const mutation = useMutation(
        trpc.skillPackageBuilder.createSkill.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof ModifiableSkill,
                        { message: error.message },
                    );
                } else {
                    toast.error(`Failed to create skill: ${error.message}`);
                    console.error("Failed to create skill:", error);
                }
            },
            async onSuccess({ created }) {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listSkills.queryFilter({
                        organizationId: organization.id,
                        skillPackageId: skillGroup.skillPackageId,
                    }),
                );

                props.onOpenChange?.(false);
                form.reset();

                router.push(
                    Paths.main(organization.slug)
                        .skillPackageBuilder.skillPackage(
                            skillGroup.skillPackageId,
                        )
                        .skill(created.id).href,
                );

                mutation.reset();
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            skillPackageId: skillGroup.skillPackageId,
            skillGroupId: skillGroup.id,
            skillId: SkillId.create(),
            create: formData,
        });
    });

    function handleCancel() {
        form.reset();
        props.onOpenChange?.(false);
    }

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Skill</DialogTitle>
                    <DialogDescription>
                        Create a new skill within the group{" "}
                        {`${skillPackage.name} / ${skillGroup.name}`}.
                    </DialogDescription>
                </DialogHeader>
                <form id="create-skill-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="skill-name">
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id="skill-name"
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
                                <Field data-invalid={fieldState.invalid}>
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
                        <Field orientation="horizontal">
                            <MutationButton
                                type="submit"
                                form="create-skill-form"
                                status={mutation.status}
                                text={{
                                    idle: "Create",
                                    pending: "Creating",
                                    success: "Created",
                                }}
                            />
                            <Show when={mutation.isIdle}>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </Button>
                            </Show>
                        </Field>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
