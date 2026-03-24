/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-ppe/templates/[template_id]/--update
 */
"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { TmplExprInput } from "@/components/controls/tmpl-expr-input";
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { useOrganization } from "@/hooks/use-organization";
import { useI3Template } from "@/hooks/use-i3-template";
import { I3Template } from "@/lib/schemas/i3-template";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export default function I3Module_UpdateTemplate_Page(
    props: PageProps<"/main/[slug]/i3/templates/[template_id]/--update">,
) {
    const { slug, template_id } = use(props.params);
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const template = useI3Template(template_id);

    const { data: categories } = useQuery(
        trpc.d4hApi.listEquipmentCategories.queryOptions({
            organizationId: organization.id,
            module: "i3",
        }),
    );

    const { data: kinds } = useQuery(
        trpc.d4hApi.listEquipmentKinds.queryOptions({
            organizationId: organization.id,
            module: "i3",
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
                await queryClient.invalidateQueries(
                    trpc.i3.listTemplates.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                router.push(Paths.main(slug).i3.template(template.id).href);
                mutation.reset();
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            templateId: template.id,
            update: formData,
        });
    });

    const selectedCategoryId = useWatch({
        control: form.control,
        name: "d4h.categoryId",
    });

    const filteredKinds = kinds?.filter(
        (k) => !selectedCategoryId || k.category.id === selectedCategoryId,
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).i3.index,
                    Paths.main(slug).i3.templates,
                    {
                        label: template.name,
                        href: Paths.main(slug).i3.template(template.id).href,
                    },
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={Paths.main(slug).i3.template(template.id)}
                            tooltip="Back to template"
                        />
                        <Hermes.Title>Update: {template.name}</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Template Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form id="update-ppe-template-form" onSubmit={handleSubmit}>
                                <FieldGroup>
                                    <Controller
                                        name="name"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                orientation="responsive"
                                                data-invalid={fieldState.invalid}
                                            >
                                                <FieldLabel htmlFor="template-name">
                                                    Name
                                                </FieldLabel>
                                                <Input
                                                    id="template-name"
                                                    aria-invalid={fieldState.invalid}
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        name="description"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                orientation="responsive"
                                                data-invalid={fieldState.invalid}
                                            >
                                                <FieldLabel htmlFor="template-description">
                                                    Description
                                                </FieldLabel>
                                                <Textarea
                                                    id="template-description"
                                                    aria-invalid={fieldState.invalid}
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        name="d4h.categoryId"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                orientation="responsive"
                                                data-invalid={fieldState.invalid}
                                            >
                                                <FieldLabel htmlFor="template-category">
                                                    D4H Category
                                                </FieldLabel>
                                                <Select
                                                    value={
                                                        field.value ? field.value.toString() : ""
                                                    }
                                                    onValueChange={(v) => {
                                                        const newCategoryId = parseInt(v, 10);
                                                        field.onChange(newCategoryId);
                                                        form.setValue(
                                                            "d4h.categoryTitle",
                                                            categories?.find(
                                                                (cat) => cat.id === newCategoryId,
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
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        name="d4h.kindId"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                orientation="responsive"
                                                data-invalid={fieldState.invalid}
                                            >
                                                <FieldLabel htmlFor="template-kind">
                                                    D4H Kind
                                                </FieldLabel>
                                                <Select
                                                    value={
                                                        field.value ? field.value.toString() : ""
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
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
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
                                                    onValueChange={(v) =>
                                                        field.onChange(v === "yes")
                                                    }
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
                                    <Controller
                                        name="d4h.outputRefFormat"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                orientation="responsive"
                                                data-invalid={fieldState.invalid}
                                            >
                                                <FieldLabel htmlFor="template-output-ref-format">
                                                    D4H Output Ref Format
                                                </FieldLabel>
                                                <TmplExprInput
                                                    id="template-output-ref-format"
                                                    aria-invalid={fieldState.invalid}
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Field orientation="horizontal">
                                        <MutationButton
                                            type="submit"
                                            form="update-ppe-template-form"
                                            status={mutation.status}
                                            text={{
                                                idle: "Save",
                                                pending: "Saving",
                                                success: "Saved",
                                            }}
                                        />
                                        <Show when={mutation.isIdle}>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    router.push(
                                                        Paths.main(slug).i3.template(template.id)
                                                            .href,
                                                    )
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        </Show>
                                    </Field>
                                </FieldGroup>
                            </form>
                        </CardContent>
                    </Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
