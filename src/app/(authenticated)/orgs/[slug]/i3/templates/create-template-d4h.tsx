/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, MutationButton } from "@/components/ui/button";
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
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { I3Template, I3TemplateId } from "@/lib/schemas/i3-template";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export function I3Module_CreateTemplate_D4H_Dialog(props: DialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

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
        defaultValues: {
            name: "",
            description: "",
            d4h: {
                categoryId: 0,
                categoryTitle: "",
                kindId: 0,
                kindTitle: "",
                outputRefFormat: "{{teamPrefix}} {{kindTitle}} {{memberRef}}",
            },
        },
    });

    function handleOpenChange(open: boolean) {
        form.reset();
        props.onOpenChange?.(open);
    }

    const mutation = useMutation(
        trpc.i3.createTemplate.mutationOptions({
            onError(error) {
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
                    Paths.org(organization.slug).i3.template(created.id).href,
                );
                mutation.reset();
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            i3TemplateId: I3TemplateId.create(),
            create: formData,
        });
    });

    const selectedCategoryId = useWatch({
        control: form.control,
        name: "d4h.categoryId",
    });
    const filteredKinds = kinds?.filter(
        (k) => k.category.id === selectedCategoryId,
    );

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg">
                <form id="create-i3-template-form" onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>New I3 Template</DialogTitle>
                        <DialogDescription>
                            Create a new I3 item template.
                        </DialogDescription>
                    </DialogHeader>

                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template-name">
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id="template-name"
                                        autoFocus
                                        autoComplete="off"
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
                                    <FieldLabel htmlFor="template-description">
                                        Description
                                    </FieldLabel>
                                    <Textarea
                                        id="template-description"
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
                            name="d4h.categoryId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template-category">
                                        D4H Category
                                    </FieldLabel>
                                    <Select
                                        value={
                                            field.value
                                                ? field.value.toString()
                                                : ""
                                        }
                                        onValueChange={(v) => {
                                            const newCategoryId = parseInt(
                                                v,
                                                10,
                                            );
                                            field.onChange(newCategoryId);
                                            form.setValue(
                                                "d4h.categoryTitle",
                                                categories?.find(
                                                    (cat) =>
                                                        cat.id ===
                                                        newCategoryId,
                                                )?.title || "",
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
                                                <SelectItem
                                                    key={cat.id}
                                                    value={cat.id.toString()}
                                                >
                                                    {cat.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="d4h.kindId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template-kind">
                                        D4H Kind
                                    </FieldLabel>
                                    <Select
                                        value={
                                            field.value
                                                ? field.value.toString()
                                                : ""
                                        }
                                        onValueChange={(v) => {
                                            const newKindId = parseInt(v, 10);
                                            field.onChange(newKindId);
                                            form.setValue(
                                                "d4h.kindTitle",
                                                filteredKinds?.find(
                                                    (k) => k.id === newKindId,
                                                )?.title || "",
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
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="d4h.outputRefFormat"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template-output-ref-format">
                                        D4H Output Ref Format
                                    </FieldLabel>
                                    <Input
                                        id="template-output-ref-format"
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

                        <DialogFooter>
                            <MutationButton
                                type="submit"
                                form="create-i3-template-form"
                                status={mutation.status}
                                text={{
                                    idle: "Create",
                                    pending: "Creating",
                                    success: "Created",
                                }}
                            />

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                            >
                                Cancel
                            </Button>
                        </DialogFooter>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
