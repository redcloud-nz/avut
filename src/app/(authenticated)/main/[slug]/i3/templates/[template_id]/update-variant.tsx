/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";

import { D4HEquipmentBrandSelect } from "@/components/controls/d4h-equipment-brand-select";
import { D4HEquipmentModelSelect } from "@/components/controls/d4h-equipment-model-select";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ObjectName } from "@/components/ui/typography";

import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { I3Template } from "@/lib/schemas/i3-template";
import { I3TemplateVariant } from "@/lib/schemas/i3-template-variant";
import { trpc } from "@/trpc/client";

interface I3Module_UpdateVariant_DialogProps extends DialogProps {
    template: I3Template;
    variant: I3TemplateVariant;
}

export function I3Module_UpdateVariant_Dialog({
    template,
    variant,
    ...props
}: I3Module_UpdateVariant_DialogProps) {
    const logger = useLogger("I3", "Template_UpdateVariant");
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const form = useForm({
        resolver: zodResolver(I3TemplateVariant.modifiableSchema),
        defaultValues: variant,
    });

    const mutation = useMutation(
        trpc.i3.updateTemplateVariant.mutationOptions({
            onError(error) {
                logger.error("Failed to update template variant", error);
                toast.error(`Failed to update template variant: ${error.message}`);
            },
            async onSuccess({ updated }) {
                logger.info(
                    `Template variant "${updated.name}" updated in template "${template.name}".`,
                );
                toast.success(
                    `Template variant "${updated.name}" updated in template "${template.name}".`,
                );

                await queryClient.invalidateQueries(
                    trpc.i3.listTemplateVariants.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            mutation.reset();
        }

        props.onOpenChange?.(open);
    }

    const handleSubmit = form.handleSubmit(
        (formData) => {
            logger.log(`Updating I3TemplateVariant(${variant.id}) with data:`, formData);
            mutation.mutate({
                organizationId: organization.id,
                templateId: template.id,
                variantId: variant.id,
                update: formData,
            });
        },
        (errors) => {
            logger.warn("Form validation failed:", errors);
        },
    );

    const selectedBrandId = form.watch("d4h.brandId");

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update Template Variant</DialogTitle>
                    <DialogDescription>
                        Update the details of this variant of template{" "}
                        <ObjectName>{template.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <form id="update-template-variant-form" onSubmit={handleSubmit}>
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
                        type="submit"
                        form="update-template-variant-form"
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
