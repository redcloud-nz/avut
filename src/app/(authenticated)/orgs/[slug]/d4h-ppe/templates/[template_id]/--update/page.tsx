/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-ppe/templates/[template_id]/--update
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
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { useD4hPpeTemplate } from "@/hooks/use-d4h-ppe-template";
import { D4hPpeTemplate } from "@/lib/schemas/d4h-ppe-template";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export default function D4hPPEModule_UpdateTemplate_Page(
    props: PageProps<"/orgs/[slug]/d4h-ppe/templates/[template_id]/--update">,
) {
    const { slug, template_id } = use(props.params);
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const template = useD4hPpeTemplate(template_id);

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

    const { data: models } = useQuery(
        trpc.d4hApi.listEquipmentModels.queryOptions({
            organizationId: organization.id,
        }),
    );

    const form = useForm({
        resolver: zodResolver(D4hPpeTemplate.modifiableSchema),
        defaultValues: template,
    });

    const selectedCategoryId = useWatch({
        control: form.control,
        name: "d4hCategoryId",
    });

    const filteredKinds = kinds?.filter(
        (k) => !selectedCategoryId || k.category.id === selectedCategoryId,
    );

    const mutation = useMutation(
        trpc.d4hPpe.updateTemplate.mutationOptions({
            onError(error) {
                toast.error(`Failed to update template: ${error.message}`);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.d4hPpe.listTemplates.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                router.push(Paths.org(slug).d4HPpe.template(template.id).href);
                mutation.reset();
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            d4hPpeTemplateId: template.id,
            update: formData,
        });
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).d4HPpe.index,
                    Paths.org(slug).d4HPpe.templates,
                    {
                        label: template.name,
                        href: Paths.org(slug).d4HPpe.template(template.id).href,
                    },
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={Paths.org(slug).d4HPpe.template(template.id)}
                            tooltip="Back to template"
                        />
                        <Hermes.Title>Update: {template.name}</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Template Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form
                                id="update-ppe-template-form"
                                onSubmit={handleSubmit}
                            >
                                <FieldGroup>
                                    <Controller
                                        name="name"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                orientation="responsive"
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                            >
                                                <FieldLabel htmlFor="template-name">
                                                    Name
                                                </FieldLabel>
                                                <Input
                                                    id="template-name"
                                                    aria-invalid={
                                                        fieldState.invalid
                                                    }
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <FieldError
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
                                                    />
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
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                            >
                                                <FieldLabel htmlFor="template-description">
                                                    Description
                                                </FieldLabel>
                                                <Textarea
                                                    id="template-description"
                                                    aria-invalid={
                                                        fieldState.invalid
                                                    }
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <FieldError
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
                                                    />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        name="d4hCategoryId"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                orientation="responsive"
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                            >
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
                                                        field.onChange(
                                                            parseInt(v, 10),
                                                        );
                                                        form.setValue(
                                                            "d4hKindId",
                                                            0,
                                                        );
                                                    }}
                                                >
                                                    <SelectTrigger
                                                        id="template-category"
                                                        aria-invalid={
                                                            fieldState.invalid
                                                        }
                                                    >
                                                        <SelectValue placeholder="Select a category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {categories?.map(
                                                            (cat) => (
                                                                <SelectItem
                                                                    key={cat.id}
                                                                    value={cat.id.toString()}
                                                                >
                                                                    {cat.title}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                {fieldState.error && (
                                                    <FieldError
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
                                                    />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        name="d4hKindId"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                orientation="responsive"
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                            >
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
                                                        field.onChange(
                                                            parseInt(v, 10),
                                                        )
                                                    }
                                                    disabled={
                                                        !selectedCategoryId
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="template-kind"
                                                        aria-invalid={
                                                            fieldState.invalid
                                                        }
                                                    >
                                                        <SelectValue placeholder="Select a kind" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {filteredKinds?.map(
                                                            (kind) => (
                                                                <SelectItem
                                                                    key={
                                                                        kind.id
                                                                    }
                                                                    value={kind.id.toString()}
                                                                >
                                                                    {kind.title}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                {fieldState.error && (
                                                    <FieldError
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
                                                    />
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
                                                        Paths.org(
                                                            slug,
                                                        ).d4HPpe.template(
                                                            template.id,
                                                        ).href,
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
