/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId } from "react";
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
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { I3Template, I3TemplateId } from "@/lib/schemas/i3-template";
import { useOrganisationOnlyId } from "@/modules/d4h-i3/lib/use-organisation-only-id";
import { trpc } from "@/trpc/client";

export function D4HI3Module_CreateTemplate_Dialog() {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["create"] as const));
    const dialogOpen = action === "create";

    function handleOpenChange(open: boolean) {
        void setAction(open ? "create" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Create />{" "}
                    <span className="sr-only md:not-sr-only">New Template</span>
                </Button>
            </DialogTrigger>
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle>New I3 Template</DialogTitle>
                    <DialogDescription>Create a new I3 item template.</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <CreateTemplate_Body />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function CreateTemplate_Body() {
    const logger = useLogger("I3", "CreateTemplate");
    const organization = useOrganization();
    const router = useRouter();

    const organisationOnlyId = useOrganisationOnlyId();

    const formId = useId();
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
            meta: { effects: i3Effects.createTemplate, navigates: true },
            onError(error) {
                logger.error(`Failed to create template`, error);
                toast.error(`Failed to create template: ${error.message}`);
            },
            onSuccess({ created }) {
                router.push(
                    route("/orgs/[slug]/d4h-i3/templates/[template_id]", {
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
            console.warn("Form validation errors:", fieldErrors);
        },
    );

    const selectedCategoryId = useWatch({
        control: form.control,
        name: "d4h.categoryId",
    });

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
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
                                    <D4HEquipmentCategorySelect
                                        value={field.value}
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
                    form={formId}
                    status={mutation.status}
                    text={{
                        idle: "Create",
                        pending: "Creating",
                        success: "Created",
                    }}
                />
            </DialogFooter>
        </>
    );
}
