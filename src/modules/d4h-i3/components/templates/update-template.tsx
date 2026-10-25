/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { i3Effects } from "@/client/i3-effects";
import { D4HEquipmentCategorySelect } from "@/components/controls/d4h-equipment-category-select";
import { D4HEquipmentTypeSelect } from "@/components/controls/d4h-equipment-type-select";
import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
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
import { useOrganisationOnlyId } from "@/modules/d4h-i3/lib/use-organisation-only-id";
import { trpc } from "@/trpc/client";

export function D4HI3Module_UpdateTemplate_Dialog({ template }: { template: I3Template }) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
    const dialogOpen = action === "update";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Update template">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update Template</DialogTitle>
                    <DialogDescription>Update the details of this template.</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <UpdateTemplate_Body
                        template={template}
                        onDone={() => handleDialogOpenChange(false)}
                    />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function UpdateTemplate_Body({ template, onDone }: { template: I3Template; onDone: () => void }) {
    const organization = useOrganization();

    const organisationOnlyId = useOrganisationOnlyId();

    const form = useForm({
        resolver: zodResolver(I3Template.modifiableSchema),
        defaultValues: template,
    });

    const mutation = useMutation(
        trpc.i3.updateTemplate.mutationOptions({
            meta: { effects: i3Effects.updateTemplate },
            onError(error) {
                toast.error(`Failed to update template: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Template <ObjectName>{template.name}</ObjectName> updated.
                    </>,
                );

                onDone();
            },
        }),
    );

    const selectedCategoryId = useWatch({
        control: form.control,
        name: "d4h.categoryId",
    });

    const handleSubmit = form.handleSubmit(
        (formData) =>
            mutation.mutate({
                organizationId: organization.id,
                templateId: template.id,
                update: formData,
            }),
        (errors) => {
            console.warn("Form validation errors:", errors);
        },
    );

    return (
        <>
            <DialogBody>
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
                                    <D4HEquipmentCategorySelect
                                        value={field.value}
                                        fallbackTitle={template.d4h?.categoryTitle}
                                        onChange={(category) => {
                                            field.onChange(category.id);
                                            form.setValue("d4h.categoryTitle", category.title);
                                            form.setValue("d4h.kindId", 0);
                                            form.setValue("d4h.kindTitle", "");
                                        }}
                                        organisationOnlyId={organisationOnlyId}
                                        slotProps={{
                                            trigger: {
                                                id: "template-category",
                                                "aria-invalid": fieldState.invalid,
                                            },
                                        }}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="d4h.kindId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template-kind">D4H Type</FieldLabel>
                                    <D4HEquipmentTypeSelect
                                        value={field.value}
                                        fallbackTitle={template.d4h?.kindTitle}
                                        onChange={(kind) => {
                                            field.onChange(kind.id);
                                            form.setValue("d4h.kindTitle", kind.title);
                                        }}
                                        categoryId={selectedCategoryId}
                                        organisationOnlyId={organisationOnlyId}
                                        disabled={!selectedCategoryId}
                                        slotProps={{
                                            trigger: {
                                                id: "template-kind",
                                                "aria-invalid": fieldState.invalid,
                                            },
                                        }}
                                    />
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
            </DialogBody>
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
        </>
    );
}
