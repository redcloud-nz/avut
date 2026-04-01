/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/forms/issue-items/[instance_id]
 */

"use client";

import { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { use, useState } from "react";
import { Controller, useFieldArray, useForm, UseFormReturn, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { match } from "ts-pattern";

import { zodResolver } from "@hookform/resolvers/zod";
import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useQuery, useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";

import { authQueries } from "@/client/auth-queries";
import {
    deleteDraftFormInstanceMutation,
    saveDraftFormInstanceMutation,
} from "@/client/form-queries";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { D4HTeamMemberSelect } from "@/components/controls/d4h-team-member-select";
import { AlertIcons, ObjectIcons } from "@/components/icons";
import { Alert, AlertTitle } from "@/components/ui/alert2";
import { Button, MutationButton } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
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
    FieldLegend,
    FieldSeparator,
} from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

import {
    I3IssuedItem,
    I3IssuedItemInput,
    I3IssueItemsFormData,
    I3IssueItemsFormInputData,
} from "@/forms/i3-issue-items/schema";
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { I3IssueItemsForm } from "@/lib/forms";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { I3Template } from "@/lib/schemas/i3-template";
import { I3TemplateVariant } from "@/lib/schemas/i3-template-variant";
import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

export default function I3Module_Issue_FormInstance_Page(
    props: PageProps<"/main/[slug]/i3/forms/issue-items/[instance_id]">,
) {
    const { slug, instance_id } = use(props.params);
    const instanceId = FormInstanceId.schema.parse(instance_id);

    const logger = useLogger("I3Module", "Issue_FormInstance_Page");
    const organization = useOrganization();
    const router = useRouter();

    const { data: instances } = useSuspenseQuery(
        trpc.forms.listDraftFormInstances.queryOptions({
            organizationId: organization.id,
            formKey: "i3-issue",
        }),
    );

    const instance = instances.find((inst) => inst.id === instanceId);
    if (!instance) throw new Error(`FormInstance(${instanceId}) not found`);

    const form = useForm({
        resolver: zodResolver(I3IssueItemsFormData.schema),
        values: instance.formData as I3IssueItemsFormData,
    });

    const saveMutation = useMutation(saveDraftFormInstanceMutation());
    const deleteMutation = useMutation(deleteDraftFormInstanceMutation());

    const submitMutation = useMutation(
        trpc.i3.submitIssueItemsForm.mutationOptions({
            onError(error) {
                toast.error(`Form processing failed: ${error.message}`);
            },
            onSuccess(_data, _variables, _result, context) {
                toast.success("Form processed successfully.");

                router.push(`/main/${slug}/i3/forms/issue-items` as Route);

                context.client.invalidateQueries(
                    trpc.forms.listDraftFormInstances.queryOptions({
                        organizationId: organization.id,
                        formKey: "i3-issue",
                    }),
                );
            },
        }),
    );

    const debouncer = useDebouncer(
        (formData: I3IssueItemsFormInputData) => {
            saveMutation.mutate({
                formInstanceId: instanceId,
                organizationId: organization.id,
                formKey: "i3-issue",
                formData,
            });
        },
        { wait: 2000 },
    );

    function handleDelete() {
        router.push(`/main/${slug}/i3/forms/issue-items` as Route);
        deleteMutation.mutate({
            formInstanceId: instanceId,
            organizationId: organization.id,
            formKey: I3IssueItemsForm.formKey,
        });
    }

    function handleChange() {
        // Reset the mutation state
        if (saveMutation.status == "success") {
            saveMutation.reset();
        }

        // Trigger the debounced mutation to save form data
        debouncer.maybeExecute(form.getValues());
    }

    const handleSubmit = form.handleSubmit(
        (formData) => {
            submitMutation.mutate({
                formInstanceId: instanceId,
                organizationId: organization.id,
                formData,
            });
        },
        (error) => {
            logger.warn("Form validation failed", error);
        },
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "I3", href: `/main/${organization.slug}/i3` },
                    { label: "Forms" },
                    {
                        label: "Issue Items",
                        href: `/main/${organization.slug}/i3/forms/issue-items`,
                    },
                    { label: form.getValues().recipient.name || "No Recipient" },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={{ href: `/main/${slug}/i3/forms/issue-items` }}
                            tooltip="Back to Form List"
                        />
                        <Hermes.Title>Issue Items</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Use this form to record items being issued to an individual.
                            </CardDescription>
                            <CardAction>
                                <SaveStatusIndicator status={saveMutation.status} />
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <form
                                id="item-issue-form"
                                onSubmit={handleSubmit}
                                onChange={handleChange}
                            >
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Issuer</FieldLabel>
                                        <UserNameFieldValue />
                                    </Field>
                                    <Controller
                                        control={form.control}
                                        name="recipient"
                                        render={({ field, fieldState }) => (
                                            <Field
                                                orientation="responsive"
                                                data-invalid={fieldState.invalid}
                                            >
                                                <FieldLabel htmlFor="recipient">
                                                    Recipient
                                                </FieldLabel>
                                                <D4HTeamMemberSelect
                                                    {...field}
                                                    organizationId={organization.id}
                                                    module="i3"
                                                    slotProps={{
                                                        trigger: {
                                                            id: "recipient",
                                                            "aria-invalid": fieldState.invalid,
                                                        },
                                                        value: {
                                                            placeholder: "Select a recipient",
                                                        },
                                                    }}
                                                />
                                                {fieldState.error && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />

                                    <FieldSeparator />

                                    <I3_Issue_ItemsSection
                                        form={form}
                                        organizationId={organization.id}
                                        onChange={handleChange}
                                    />

                                    <FieldSeparator />

                                    <Controller
                                        control={form.control}
                                        name="comments"
                                        render={({ field, fieldState }) => (
                                            <Field
                                                orientation="responsive"
                                                data-invalid={fieldState.invalid}
                                            >
                                                <FieldLabel htmlFor="comments">Comments</FieldLabel>
                                                <Textarea
                                                    id="comments"
                                                    {...field}
                                                    aria-invalid={fieldState.invalid}
                                                />
                                                {fieldState.error && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Field orientation="horizontal" className="justify-between">
                                        <MutationButton
                                            type="submit"
                                            status={submitMutation.status}
                                            text={{
                                                idle: "Submit",
                                                pending: "Submitting",
                                                success: "Submitted",
                                            }}
                                        />
                                        <Button
                                            variant="ghost"
                                            onClick={handleDelete}
                                            className="text-destructive"
                                        >
                                            <ObjectIcons.Delete />
                                        </Button>
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

function SaveStatusIndicator({ status }: { status: ReturnType<typeof useMutation>["status"] }) {
    return (
        <div className="relative w-12 h-4">
            {match(status)
                .with("idle", () => null)
                .with("pending", () => (
                    <>
                        <div className="font-semibold text-center">Saving</div>
                        <Spinner className="absolute size-8 transform -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 opacity-25" />
                    </>
                ))
                .with("success", () => (
                    <>
                        <div className="font-semibold text-center">Saved</div>
                    </>
                ))
                .with("error", () => (
                    <>
                        <div className="font-semibold text-center">Error</div>
                    </>
                ))
                .exhaustive()}
        </div>
    );
}

function UserNameFieldValue() {
    const { data, error, isPending } = useQuery(authQueries.session);

    if (isPending) {
        return <Skeleton className="min-w-1/2 h-8" />;
    } else if (error) {
        return (
            <Alert variant="warning" className="min-w-1/2">
                <AlertIcons.Warning />
                <AlertTitle>Unable to load user information.</AlertTitle>
            </Alert>
        );
    } else if (data) {
        return <FieldValue value={data.user.name} />;
    }
}

/**
 * Section for managing the list of items being issued, including the "Add Item" dialog.
 */
function I3_Issue_ItemsSection({
    form,
    organizationId,
    onChange,
}: {
    form: UseFormReturn<I3IssueItemsFormInputData>;
    organizationId: OrganizationId;
    onChange: () => void;
}) {
    const [{ data: templates }, { data: variants }] = useSuspenseQueries({
        queries: [
            trpc.i3.listTemplates.queryOptions({ organizationId }),
            trpc.i3.listTemplateVariants.queryOptions({ organizationId }),
        ],
    });

    const [targetIndex, setTargetIndex] = useState<number | "new" | null>(null);

    const {
        fields: items,
        append: appendItem,
        update: updateItem,
        remove: removeItem,
    } = useFieldArray({
        control: form.control,
        name: "items",
    });

    const error = form.formState.errors.items;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <FieldLegend>Issued Items</FieldLegend>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTargetIndex("new")}
                >
                    Add Item
                </Button>
            </div>

            <ItemGroup>
                {items.map((item, index) => {
                    const template = templates.find((template) => template.id === item.template.id);
                    const variant = item.variant
                        ? variants.find((variant) => variant.id === item.variant?.id)
                        : null;

                    return (
                        <Item size="sm" key={item.id} className="pr-0">
                            <ItemContent>
                                <ItemTitle>{template?.name}</ItemTitle>
                                <ItemDescription>
                                    {[
                                        variant?.name,
                                        item.serialNumber ? `S/N: ${item.serialNumber}` : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" - ")}
                                </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <ButtonGroup>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setTargetIndex(index)}
                                    >
                                        <ObjectIcons.Edit />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            removeItem(index);
                                            onChange();
                                        }}
                                    >
                                        <ObjectIcons.Delete />
                                    </Button>
                                </ButtonGroup>
                            </ItemActions>
                        </Item>
                    );
                })}
            </ItemGroup>
            {error && <FieldError errors={[error]} />}

            <AddItemDialog
                open={targetIndex === "new"}
                onOpenChange={(open) => setTargetIndex(open ? "new" : null)}
                templates={templates}
                variants={variants}
                onAdd={(item) => {
                    appendItem(item);
                    onChange();
                }}
            />
            {typeof targetIndex === "number" && (
                <EditItemDialog
                    open={true}
                    onOpenChange={(open) => setTargetIndex(open ? targetIndex : null)}
                    templates={templates}
                    variants={variants}
                    item={items[targetIndex as number]}
                    onUpdate={(item) => {
                        updateItem(targetIndex as number, item);
                        onChange();
                    }}
                />
            )}
        </div>
    );
}

interface AddItemDialogProps extends DialogProps {
    templates: I3Template[];
    variants: I3TemplateVariant[];
    onAdd: (item: I3IssuedItemInput) => void;
}

/**
 * Dialog for adding an item to the issue list.
 */
function AddItemDialog({ onAdd, templates, variants, ...props }: AddItemDialogProps) {
    const form = useForm({
        resolver: zodResolver(I3IssuedItem.schema),
        defaultValues: {
            template: { id: "", name: "" },
            variant: null,
            serialNumber: "",
        },
    });

    function handleOpenChange(open: boolean) {
        props?.onOpenChange?.(open);
        if (!open) {
            form.reset();
        }
    }

    const handleSubmit = form.handleSubmit(
        (formData) => {
            console.log("Adding item with data:", formData);
            onAdd(formData);
            handleOpenChange(false);
        },
        (error) => {
            console.error("Unable to add item: ", error);
        },
    );

    const currentTemplateId = useWatch({ control: form.control, name: "template.id" });
    const currentTemplate = templates.find((template) => template.id === currentTemplateId);

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Issued Item</DialogTitle>
                    <DialogDescription>Select the item being issued.</DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Controller
                        control={form.control}
                        name="template"
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="template">Template</FieldLabel>
                                <Select
                                    value={field.value.id ?? ""}
                                    onValueChange={(value) => {
                                        const selectedTemplate = templates.find(
                                            (template) => template.id === value,
                                        );
                                        field.onChange(
                                            selectedTemplate
                                                ? {
                                                      id: selectedTemplate.id,
                                                      name: selectedTemplate.name,
                                                  }
                                                : { id: "", name: "" },
                                        );
                                    }}
                                >
                                    <SelectTrigger id="template" aria-invalid={fieldState.invalid}>
                                        <SelectValue placeholder="Select a template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map((template) => (
                                            <SelectItem key={template.id} value={template.id}>
                                                {template.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Controller
                        control={form.control}
                        name="variant"
                        render={({ field, fieldState }) => {
                            const applicableVariants = currentTemplate
                                ? variants.filter(
                                      (variant) => variant.templateId === currentTemplate.id,
                                  )
                                : [];

                            return (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="variant">Variant</FieldLabel>

                                    <Select
                                        value={field.value?.id ?? ""}
                                        onValueChange={(value) => {
                                            const selectedVariant = variants.find(
                                                (variant) => variant.id === value,
                                            );
                                            field.onChange(
                                                selectedVariant
                                                    ? {
                                                          id: selectedVariant.id,
                                                          name: selectedVariant.name,
                                                      }
                                                    : null,
                                            );
                                        }}
                                        disabled={!currentTemplate}
                                    >
                                        <SelectTrigger
                                            id="variant"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue placeholder="Select a variant" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {applicableVariants.map((variant) => (
                                                <SelectItem key={variant.id} value={variant.id}>
                                                    {variant.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            );
                        }}
                    />
                    <Controller
                        control={form.control}
                        name="serialNumber"
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="serialNumber">Serial Number</FieldLabel>

                                <Input
                                    id="serialNumber"
                                    value={field.value ?? ""}
                                    onChange={field.onChange}
                                    aria-invalid={fieldState.invalid}
                                    disabled={!(currentTemplate?.d4h?.requireSN ?? false)}
                                    placeholder={
                                        currentTemplate?.d4h?.requireSN ? "Enter S/N" : "N/A"
                                    }
                                />
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                </FieldGroup>
                <DialogFooter>
                    <Button type="button" onClick={handleSubmit}>
                        Add
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface EditItemDialogProps extends DialogProps {
    templates: I3Template[];
    variants: I3TemplateVariant[];
    item: I3IssuedItemInput;
    onUpdate: (updatedItem: I3IssuedItemInput) => void;
}

function EditItemDialog({ item, onUpdate, templates, variants, ...props }: EditItemDialogProps) {
    const form = useForm({
        resolver: zodResolver(I3IssuedItem.schema),
        defaultValues: item,
    });

    function handleOpenChange(open: boolean) {
        props?.onOpenChange?.(open);
        if (!open) {
            form.reset();
        }
    }

    const handleSubmit = form.handleSubmit(
        (formData) => {
            console.log("Updating item with data:", formData);
            onUpdate(formData);
            handleOpenChange(false);
        },
        (error) => {
            console.error("Unable to update item: ", error);
        },
    );

    const currentTemplateId = useWatch({ control: form.control, name: "template.id" });
    const currentTemplate = templates.find((template) => template.id === currentTemplateId);

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Issued Item</DialogTitle>
                    <DialogDescription>Update the details of the issued item.</DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Controller
                        control={form.control}
                        name="template"
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="template">Template</FieldLabel>
                                <Select
                                    value={field.value.id ?? ""}
                                    onValueChange={(value) => {
                                        const selectedTemplate = templates.find(
                                            (template) => template.id === value,
                                        );
                                        field.onChange(
                                            selectedTemplate
                                                ? {
                                                      id: selectedTemplate.id,
                                                      name: selectedTemplate.name,
                                                  }
                                                : { id: "", name: "" },
                                        );
                                    }}
                                >
                                    <SelectTrigger id="template" aria-invalid={fieldState.invalid}>
                                        <SelectValue placeholder="Select a template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map((template) => (
                                            <SelectItem key={template.id} value={template.id}>
                                                {template.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Controller
                        control={form.control}
                        name="variant"
                        render={({ field, fieldState }) => {
                            const applicableVariants = currentTemplate
                                ? variants.filter(
                                      (variant) => variant.templateId === currentTemplate.id,
                                  )
                                : [];

                            return (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="variant">Variant</FieldLabel>

                                    <Select
                                        value={field.value?.id ?? ""}
                                        onValueChange={(value) => {
                                            const selectedVariant = variants.find(
                                                (variant) => variant.id === value,
                                            );
                                            field.onChange(
                                                selectedVariant
                                                    ? {
                                                          id: selectedVariant.id,
                                                          name: selectedVariant.name,
                                                      }
                                                    : null,
                                            );
                                        }}
                                        disabled={!currentTemplate}
                                    >
                                        <SelectTrigger
                                            id="variant"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue placeholder="Select a variant" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {applicableVariants.map((variant) => (
                                                <SelectItem key={variant.id} value={variant.id}>
                                                    {variant.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            );
                        }}
                    />
                    <Controller
                        control={form.control}
                        name="serialNumber"
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="serialNumber">Serial Number</FieldLabel>

                                <Input
                                    id="serialNumber"
                                    value={field.value ?? ""}
                                    onChange={field.onChange}
                                    aria-invalid={fieldState.invalid}
                                    disabled={!(currentTemplate?.d4h?.requireSN ?? false)}
                                    placeholder={
                                        currentTemplate?.d4h?.requireSN ? "Enter S/N" : "N/A"
                                    }
                                />
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                </FieldGroup>
                <DialogFooter>
                    <Button type="button" onClick={handleSubmit}>
                        Update
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
