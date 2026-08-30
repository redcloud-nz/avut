/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

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
import { ObjectName } from "@/components/ui/typography";

import { skillPackageBuilderEffects } from "@/client/skill-package-builder-effects";
import { useOrganization } from "@/hooks/use-organization";
import { ModifiableSkill, Skill, SkillId } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_CreateSkill_Dialog({
    skillGroup,
    skillPackage,
}: {
    skillGroup: SkillGroup;
    skillPackage: SkillPackage;
}) {
    const organization = useOrganization();
    const router = useRouter();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["create"] as const));
    const dialogOpen = action === "create";

    const form = useForm({
        resolver: zodResolver(Skill.modifiableSchema),
        defaultValues: {
            name: "",
            description: "",
            tags: [],
            properties: {},
            frequency: 12,
            defaultRequired: false,
        },
    });

    const mutation = useMutation(
        trpc.skillPackageBuilder.createSkill.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.createSkill },
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(error.shape.cause.message as keyof ModifiableSkill, {
                        message: error.message,
                    });
                } else {
                    toast.error(`Failed to create skill: ${error.message}`);
                    console.error("Failed to create skill:", error);
                }
            },
            onSuccess({ created }) {
                toast.success(
                    <>
                        Skill <ObjectName>{created.name}</ObjectName> created successfully!
                    </>,
                );

                router.push(
                    route(
                        "/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]",
                        {
                            slug: organization.slug,
                            package_id: skillGroup.skillPackageId,
                            skill_id: created.id,
                        },
                    ),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            mutation.mutate({
                organizationId: organization.id,
                skillPackageId: skillGroup.skillPackageId,
                skillGroupId: skillGroup.id,
                skillId: SkillId.create(),
                create: formData,
            });
        },
        (errors) => {
            console.error("Form validation errors:", errors);
        },
    );

    function handleOpenChange(open: boolean) {
        if (open) {
            void setAction("create", { history: "push" });
        } else {
            form.reset();
            mutation.reset();
            void setAction(null, { history: "replace" });
        }
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <ObjectIcons.Create />
                </Button>
            </DialogTrigger>
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
                                    <FieldLabel htmlFor="skill-name">Name</FieldLabel>
                                    <Input
                                        id="skill-name"
                                        autoFocus
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
                        form="create-skill-form"
                        status={mutation.status}
                        text={{
                            idle: "Create",
                            pending: "Creating",
                            success: "Created",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
