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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import {
    D4hPpeTemplate,
    D4hPpeTemplateId,
} from "@/lib/schemas/d4h-ppe-template";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export function D4hPPEModule_CreateTemplate_Dialog(props: DialogProps) {
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
        resolver: zodResolver(D4hPpeTemplate.modifiableSchema),
        defaultValues: {
            name: "",
            description: "",
            d4hCategoryId: 0,
            d4hKindId: 0,
            status: "Active",
        },
    });

    const selectedCategoryId = useWatch({
        control: form.control,
        name: "d4hCategoryId",
    });

    const filteredKinds = kinds?.filter(
        (k) => !selectedCategoryId || k.category.id === selectedCategoryId,
    );

    function handleOpenChange(open: boolean) {
        form.reset();
        props.onOpenChange?.(open);
    }

    const mutation = useMutation(
        trpc.d4hPpe.createTemplate.mutationOptions({
            onError(error) {
                toast.error(`Failed to create template: ${error.message}`);
            },
            async onSuccess({ created }) {
                await queryClient.invalidateQueries(
                    trpc.d4hPpe.listTemplates.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                handleOpenChange(false);
                router.push(
                    Paths.org(organization.slug).d4HPpe.template(created.id)
                        .href,
                );
                mutation.reset();
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        console.log("Creating PPE Template with data:", formData);
        mutation.mutate({
            organizationId: organization.id,
            d4hPpeTemplateId: D4hPpeTemplateId.create(),
            create: formData,
        });
    });

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>New PPE Template</DialogTitle>
                    <DialogDescription>
                        Create a new PPE inspection template.
                    </DialogDescription>
                </DialogHeader>
                <form id="create-ppe-template-form" onSubmit={handleSubmit}>
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
                            name="d4hCategoryId"
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
                                            field.onChange(parseInt(v, 10));
                                            form.setValue("d4hKindId", 0);
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
                            name="d4hKindId"
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
                                        onValueChange={(v) =>
                                            field.onChange(parseInt(v, 10))
                                        }
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
                        <div>
                            {JSON.stringify(form.formState.errors, null, 2)}
                        </div>
                        <Field orientation="horizontal">
                            <MutationButton
                                type="submit"
                                form="create-ppe-template-form"
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
                                    onClick={() => handleOpenChange(false)}
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
