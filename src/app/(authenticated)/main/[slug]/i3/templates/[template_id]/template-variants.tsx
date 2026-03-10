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
import {
    useMutation,
    useQueries,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ObjectName } from "@/components/ui/typography";

import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { I3Template } from "@/lib/schemas/i3-template";
import {
    I3TemplateVariant,
    I3TemplateVariantId,
} from "@/lib/schemas/i3-template-variant";
import { trpc } from "@/trpc/client";

export function I3Module_Template_Variants_List({
    template,
}: {
    template: I3Template;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const { data: variants } = useSuspenseQuery(
        trpc.i3.listTemplateVariants.queryOptions({
            organizationId: organization.id,
            templateId: template.id,
        }),
    );

    const [addDialogOpen, setAddDialogOpen] = useState(false);

    const deleteMutation = useMutation(
        trpc.i3.deleteTemplateVariant.mutationOptions({
            onError(error) {
                console.error("Failed to delete template variant:", error);
                toast.error(
                    `Failed to delete template variant: ${error.message}`,
                );
            },
            async onSuccess(data) {
                await queryClient.invalidateQueries(
                    trpc.i3.listTemplateVariants.queryFilter({
                        organizationId: organization.id,
                        templateId: template.id,
                    }),
                );
                toast.success(
                    `Template variant "${data.deleted.name}" deleted.`,
                );
            },
        }),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Variants</CardTitle>
                <CardAction>
                    <Protect
                        orgId={organization.id}
                        permissions={{ i3Template: ["update"] }}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            tooltip="Add variant"
                            onClick={() => setAddDialogOpen(true)}
                        >
                            <ObjectIcons.Create />
                        </Button>
                    </Protect>
                </CardAction>
            </CardHeader>
            <CardContent>
                <Show
                    when={variants.length > 0}
                    fallback={
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No variants yet</EmptyTitle>
                                <EmptyDescription>
                                    You have not added any variants to this
                                    template yet. Click the
                                    <ObjectIcons.Create className="inline-block mx-1 size-4" />
                                    button to add a variant.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell>Name</TableHeadCell>
                                <TableHeadCell>Brand</TableHeadCell>
                                <TableHeadCell>Model</TableHeadCell>
                                <TableHeadCell></TableHeadCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {variants.map((variant, index) => {
                                return (
                                    <TableRow key={index}>
                                        <TableCell>{variant.name}</TableCell>
                                        <TableCell>
                                            {variant.d4h?.brandTitle ??
                                                `ID: ${variant.d4h?.brandId}`}
                                        </TableCell>
                                        <TableCell>
                                            {variant.d4h?.modelTitle ??
                                                `ID: ${variant.d4h?.modelId}`}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                tooltip="Delete variant"
                                                disabled={
                                                    deleteMutation.isPending
                                                }
                                                onClick={() =>
                                                    deleteMutation.mutate({
                                                        organizationId:
                                                            organization.id,
                                                        templateId: template.id,
                                                        variantId: variant.id,
                                                    })
                                                }
                                            >
                                                <ObjectIcons.Delete />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Show>
            </CardContent>

            <I3Module_Template_AddVariant_Dialog
                template={template}
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
            />
        </Card>
    );
}

function I3Module_Template_AddVariant_Dialog({
    template,
    ...props
}: DialogProps & { template: I3Template }) {
    const logger = useLogger("I3", "Template_AddVariant");
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [
        { data: brands = [], isSuccess: brandsLoaded },
        { data: models = [], isSuccess: modelsLoaded },
    ] = useQueries({
        queries: [
            trpc.d4hApi.listEquipmentBrands.queryOptions(
                {
                    organizationId: organization.id,
                },
                { enabled: props.open },
            ),
            trpc.d4hApi.listEquipmentModels.queryOptions(
                {
                    organizationId: organization.id,
                },
                { enabled: props.open },
            ),
        ],
    });

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
                toast.error(
                    `Failed to create template variant: ${error.message}`,
                );
            },
            async onSuccess() {
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
        props.onOpenChange?.(open);

        form.reset();
        mutation.reset();
    }

    const handleSubmit = form.handleSubmit(
        (formData) => {
            const variantId = I3TemplateVariantId.create();

            logger.log(
                `Creating I3TemplateVariant(${variantId}) with data:`,
                formData,
            );
            mutation.mutate({
                organizationId: organization.id,
                templateId: template.id,
                variantId: variantId,
                create: formData,
            });
        },
        (error) => {
            logger.warn("Form validation failed:", error);
        },
    );

    const selectedBrandId = form.watch("d4h.brandId");
    const filteredModels = models.filter(
        (model) => model.brand.id === selectedBrandId,
    );

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Variant to Template</DialogTitle>
                    <DialogDescription>
                        Add a new variant to template{" "}
                        <ObjectName>{template.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Controller
                        name="name"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="variant-name">
                                    Name
                                </FieldLabel>
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
                                <FieldLabel htmlFor="variant-brand">
                                    Brand
                                </FieldLabel>
                                <Show
                                    when={brandsLoaded}
                                    fallback={
                                        <Skeleton className="w-full h-8" />
                                    }
                                >
                                    <Select
                                        value={(field.value || "") + ""}
                                        onValueChange={(newValue) => {
                                            const newBrandId = parseInt(
                                                newValue,
                                                10,
                                            );
                                            const brand = brands?.find(
                                                (b) => b.id === newBrandId,
                                            );

                                            field.onChange(newBrandId);
                                            form.setValue(
                                                "d4h.brandTitle",
                                                brand?.title ?? "",
                                            );
                                            form.setValue("d4h.modelId", 0);
                                        }}
                                    >
                                        <SelectTrigger id="variant-brand">
                                            <SelectValue placeholder="Select a brand" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {brands?.map((brand) => (
                                                <SelectItem
                                                    key={brand.id}
                                                    value={brand.id.toString()}
                                                >
                                                    {brand.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Show>
                            </Field>
                        )}
                    />
                    <Controller
                        control={form.control}
                        name="d4h.modelId"
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="variant-model">
                                    Model
                                </FieldLabel>
                                <Show
                                    when={modelsLoaded}
                                    fallback={
                                        <Skeleton className="w-full h-8" />
                                    }
                                >
                                    <Select
                                        value={(field.value || "") + ""}
                                        onValueChange={(newValue) => {
                                            const newModelId = parseInt(
                                                newValue,
                                                10,
                                            );
                                            const model = models?.find(
                                                (m) => m.id === newModelId,
                                            );

                                            field.onChange(newModelId);
                                            form.setValue(
                                                "d4h.modelTitle",
                                                model?.title ?? "",
                                            );
                                        }}
                                        disabled={!selectedBrandId}
                                    >
                                        <SelectTrigger id="variant-model">
                                            <SelectValue placeholder="Select a model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredModels.map((model) => (
                                                <SelectItem
                                                    key={model.id}
                                                    value={model.id.toString()}
                                                >
                                                    {model.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Show>
                            </Field>
                        )}
                    />
                </FieldGroup>
                <DialogFooter>
                    <MutationButton
                        type="submit"
                        status={mutation.status}
                        text={{
                            idle: "Add",
                            pending: "Adding",
                            success: "Added",
                        }}
                        onClick={handleSubmit}
                    />

                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                    >
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
