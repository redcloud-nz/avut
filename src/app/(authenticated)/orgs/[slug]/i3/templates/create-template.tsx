/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";

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

import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { I3Template, I3TemplateId } from "@/lib/schemas/i3-template";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function I3Module_CreateTemplate_Dialog() {
    const logger = useLogger("I3", "CreateTemplate");
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const [dialogOpen, setDialogOpen] = useState(false);

    const [{ data: categories }, { data: kinds }] = useQueries({
        queries: [
            trpc.d4hApi.listEquipmentCategories.queryOptions({
                organizationId: organization.id,
            }),
            trpc.d4hApi.listEquipmentKinds.queryOptions({
                organizationId: organization.id,
            }),
        ],
    });

    const form = useForm({
        resolver: zodResolver(I3Template.modifiableSchema),
        defaultValues: {
            name: "",
            description: "",
            d4h: {
                categoryId: 0,
                categoryTitle: "",
                kindId: 0,
                kindTitle: "",
                requireSN: false,
                outputRefFormat: "{{team.prefix}} {{kind.title}} {{member.ref}}",
            },
        },
    });

    const mutation = useMutation(
        trpc.i3.createTemplate.mutationOptions({
            onError(error) {
                logger.error(`Failed to create template`, error);
                toast.error(`Failed to create template: ${error.message}`);
            },
            async onSuccess({ created }) {
                await queryClient.invalidateQueries(
                    trpc.i3.listTemplates.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                handleOpenChange(false);
                router.push(
                    route("/orgs/[slug]/i3/templates/[template_id]", {
                        slug: organization.slug,
                        template_id: created.id,
                    }),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            logger.log(`Creating template`, formData);
            mutation.mutate({
                organizationId: organization.id,
                templateId: I3TemplateId.create(),
                create: formData,
            });
        },
        (fieldErrors) => {
            logger.warn(`Validation failed`, fieldErrors);
        },
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }
        setDialogOpen(open);
    }

    const selectedCategoryId = useWatch({
        control: form.control,
        name: "d4h.categoryId",
    });
    const filteredKinds = kinds?.filter((k) => k.category.id === selectedCategoryId);

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Create /> <span className="hidden md:inline">New Template</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>New I3 Template</DialogTitle>
                    <DialogDescription>Create a new I3 item template.</DialogDescription>
                </DialogHeader>
                <form id="create-template-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template-name">Name</FieldLabel>
                                    <Input
                                        id="template-name"
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
                        form="create-template-form"
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
