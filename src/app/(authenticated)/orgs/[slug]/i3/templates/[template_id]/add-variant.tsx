/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { D4HEquipmentBrandSelect } from "@/components/controls/d4h-equipment-brand-select";
import { D4HEquipmentModelSelect } from "@/components/controls/d4h-equipment-model-select";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ObjectName } from "@/components/ui/typography";

import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { I3Template } from "@/lib/schemas/i3-template";
import { I3TemplateVariant, I3TemplateVariantId } from "@/lib/schemas/i3-template-variant";
import { trpc } from "@/trpc/client";

export function I3Module_Template_AddVariant_Dialog({ template }: { template: I3Template }) {
    const logger = useLogger("I3", "Template_AddVariant");
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [dialogOpen, setDialogOpen] = useState(false);

    const form = useForm({
        resolver: zodResolver(I3TemplateVariant.modifiableSchema),
        defaultValues: {
            name: "",
            d4h: {
                brandId: 0,
                brandTitle: "",
                modelId: 0,
                modelTitle: "",
            },
        },
    });

    const mutation = useMutation(
        trpc.i3.createTemplateVariant.mutationOptions({
            onError(error) {
                logger.error("Failed to create template variant", error);
                toast.error(`Failed to create template variant: ${error.message}`);
            },
            async onSuccess({ created }) {
                logger.info(
                    `Template variant "${created.name}" added to template "${template.name}".`,
                );
                toast.success(
                    `Template variant "${created.name}" added to template "${template.name}".`,
                );

                queryClient.setQueryData(
                    trpc.i3.listTemplates.queryKey({
                        organizationId: organization.id,
                    }),
                    (old) => {
                        if (!old) return old;

                        return old.map((t) => {
                            if (t.id === template.id) {
                                return {
                                    ...t,
                                    variants: [...t.variants, created],
                                };
                            }
                            return t;
                        });
                    },
                );

                await queryClient.invalidateQueries(
                    trpc.i3.listTemplateVariants.queryFilter({
                        organizationId: organization.id,
                        templateId: template.id,
                    }),
                );
                handleOpenChange(false);
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

    const handleSubmit = form.handleSubmit(
        (formData) => {
            const variantId = I3TemplateVariantId.create();

            logger.log(`Creating I3TemplateVariant(${variantId}) with data:`, formData);
            mutation.mutate({
                organizationId: organization.id,
                templateId: template.id,
                variantId: variantId,
                create: formData,
            });
        },
        (errors) => {
            logger.warn("Form validation failed:", errors);
        },
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() returns non-memoizable values
    const selectedBrandId = form.watch("d4h.brandId");

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <ObjectIcons.Create />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Variant to Template</DialogTitle>
                    <DialogDescription>
                        Add a new variant to template <ObjectName>{template.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <form id="create-template-variant-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="variant-name">Name</FieldLabel>
                                    <Input
                                        id="variant-name"
                                        autoFocus
                                        autoComplete="off"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="d4h.brandId"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="variant-brand">Brand</FieldLabel>

                                    <D4HEquipmentBrandSelect
                                        value={field.value}
                                        onChange={(brand) => {
                                            field.onChange(brand.id);
                                            form.setValue("d4h.brandTitle", brand.title);

                                            // Reset model selection when brand changes
                                            form.setValue("d4h.modelId", 0);
                                            form.setValue("d4h.modelTitle", "");
                                        }}
                                        slotProps={{
                                            trigger: { id: "variant-brand" },
                                        }}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="d4h.modelId"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="variant-model">Model</FieldLabel>
                                    <D4HEquipmentModelSelect
                                        value={field.value}
                                        onChange={(model) => {
                                            field.onChange(model.id);
                                            form.setValue("d4h.modelTitle", model.title);
                                        }}
                                        brandId={selectedBrandId}
                                        slotProps={{
                                            trigger: { id: "variant-model" },
                                        }}
                                    />

                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        form="create-template-variant-form"
                        type="submit"
                        status={mutation.status}
                        text={{
                            idle: "Add",
                            pending: "Adding",
                            success: "Added",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
