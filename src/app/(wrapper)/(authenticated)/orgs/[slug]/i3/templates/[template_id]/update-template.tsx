/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { I3Template } from "@/lib/schemas/i3-template";
import { trpc } from "@/trpc/client";

export function I3Module_UpdateTemplate_Dialog({ template }: { template: I3Template }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
    const dialogOpen = action === "update";

    const { data: categories } = useQuery(
        trpc.d4hApi.listEquipmentCategories.queryOptions({
            organizationId: organization.id,
        }),
    );

    const { data: kinds } = useQuery(
        trpc.d4hApi.listEquipmentKinds.queryOptions({
            organizationId: organization.id,
        }),
    );

    const form = useForm({
        resolver: zodResolver(I3Template.modifiableSchema),
        defaultValues: template,
    });

    const mutation = useMutation(
        trpc.i3.updateTemplate.mutationOptions({
            onError(error) {
                toast.error(`Failed to update template: ${error.message}`);
            },
            async onSuccess() {
                toast.success(
                    <>
                        Template <ObjectName>{template.name}</ObjectName> updated.
                    </>,
                );

                handleDialogOpenChange(false);

                await queryClient.invalidateQueries(
                    trpc.i3.listTemplates.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    const selectedCategoryId = useWatch({
        control: form.control,
        name: "d4h.categoryId",
    });

    const filteredKinds = kinds?.filter(
        (k) => !selectedCategoryId || k.category.id === selectedCategoryId,
    );

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset(template);
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        (formData) =>
            mutation.mutate({
                organizationId: organization.id,
                templateId: template.id,
                update: formData,
            }),
        (errors) => {
            console.error("Form validation errors:", errors);
        },
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update Template</DialogTitle>
                    <DialogDescription>Update the details of this template.</DialogDescription>
                </DialogHeader>
                <form id="update-template-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template-name">Name</FieldLabel>
                                    <Input
                                        id="template-name"
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
                                    <FieldLabel htmlFor="template-description">
                                        Description
                                    </FieldLabel>
                                    <Textarea
                                        id="template-description"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="d4h.categoryId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template-category">
                                        D4H Category
                                    </FieldLabel>
                                    <Select
                                        value={field.value ? field.value.toString() : ""}
                                        onValueChange={(v) => {
                                            const newCategoryId = parseInt(v, 10);
                                            field.onChange(newCategoryId);
                                            form.setValue(
                                                "d4h.categoryTitle",
                                                categories?.find((cat) => cat.id === newCategoryId)
                                                    ?.title || "",
                                            );
                                            form.setValue("d4h.kindId", 0);
                                            form.setValue("d4h.kindTitle", "");
                                        }}
                                    >
                                        <SelectTrigger
                                            id="template-category"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories?.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                                    {cat.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="d4h.kindId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template-kind">D4H Kind</FieldLabel>
                                    <Select
                                        value={field.value ? field.value.toString() : ""}
                                        onValueChange={(v) => {
                                            const newKindId = parseInt(v, 10);
                                            field.onChange(newKindId);
                                            form.setValue(
                                                "d4h.kindTitle",
                                                filteredKinds?.find((k) => k.id === newKindId)
                                                    ?.title || "",
                                            );
                                        }}
                                        disabled={!selectedCategoryId}
                                    >
                                        <SelectTrigger
                                            id="template-kind"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue placeholder="Select a kind" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredKinds?.map((kind) => (
                                                <SelectItem
                                                    key={kind.id}
                                                    value={kind.id.toString()}
                                                >
                                                    {kind.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="d4h.requireSN"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template-require-sn">
                                        Require Serial Number
                                    </FieldLabel>
                                    <Select
                                        value={field.value ? "yes" : "no"}
                                        onValueChange={(v) => field.onChange(v === "yes")}
                                    >
                                        <SelectTrigger
                                            id="template-require-sn"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="yes">Yes</SelectItem>
                                            <SelectItem value="no">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-template-form"
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
