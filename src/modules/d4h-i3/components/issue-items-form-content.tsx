/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm, UseFormReturn, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useSuspenseQueries } from "@tanstack/react-query";

import { i3Effects } from "@/client/i3-effects";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { D4HTeamMemberSelect } from "@/components/controls/d4h-team-member-select";
import { HelpButton } from "@/components/docs/help-button";
import { AlertWarningIcon, ObjectIcons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, MutationButton } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    I3IssuedItem,
    I3IssuedItemInput,
    I3IssueItemsFormData,
    I3IssueItemsFormInputData,
} from "@/forms/i3-issue-items/schema";
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { hasD4HTeamPermission } from "@/lib/d4h-permissions";
import { I3IssueItemsForm } from "@/lib/forms";
import { route } from "@/lib/routes";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { I3Template } from "@/lib/schemas/i3-template";
import { I3TemplateVariant } from "@/lib/schemas/i3-template-variant";
import { OrganizationId } from "@/lib/schemas/organization";
import { useDraftFormAutosave, UserNameFieldValue } from "@/modules/d4h-i3/components/form-shared";
import { trpc } from "@/trpc/client";

/**
 * A draft Issue Items form: recipient, the items being issued, comments, and Submit.
 */
export function D4HI3Module_IssueItems_FormInstance_Content({
    instanceId,
}: {
    instanceId: FormInstanceId;
}) {
    const logger = useLogger("I3Module", "IssueItems_FormInstance_Content");
    const organization = useOrganization();
    const router = useRouter();
    const slug = organization.slug;

    const [{ data: instances }, { data: accessibleTeams }] = useSuspenseQueries({
        queries: [
            trpc.forms.listDraftFormInstances.queryOptions({
                organizationId: organization.id,
                formKey: I3IssueItemsForm.formKey,
            }),
            trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
        ],
    });

    const instance = instances.find((inst) => inst.id === instanceId);
    if (!instance) throw new Error(`FormInstance(${instanceId}) not found`);

    const form = useForm({
        resolver: zodResolver(I3IssueItemsFormData.schema),
        values: instance.formData as I3IssueItemsFormData,
    });

    const recipient = useWatch({ control: form.control, name: "recipient" });

    const recipientTeam = accessibleTeams.find((team) => team.id === recipient.teamId);
    const lacksCreatePermission =
        recipient.id > 0 &&
        !hasD4HTeamPermission(recipientTeam?.permissions, "Equipment", "CREATE");
    const recipientTeamTitle = recipientTeam?.title ?? "this team";

    // Non-suspending on purpose (see the #454 plan): a D4H failure shows a warning rather than
    // blanking the form, and the server re-checks fit on submit.
    const fitsQuery = useQuery(
        trpc.i3.listTemplateFits.queryOptions(
            { organizationId: organization.id, teamId: recipient.teamId },
            { enabled: recipient.teamId > 0 },
        ),
    );
    const fits: TemplateFits | undefined = fitsQuery.isSuccess
        ? {
              templateIds: new Set(fitsQuery.data.templateIds),
              variantIds: new Set(fitsQuery.data.variantIds),
          }
        : undefined;
    // Until the fits arrive, every template is offered, so Submit waits for them.
    const checkingFits = recipient.teamId > 0 && fitsQuery.isPending;

    const items = useWatch({ control: form.control, name: "items" });
    const misfitIndexes = fits
        ? items.flatMap((item, index) => (itemFits(item, fits) ? [] : [index]))
        : [];

    const {
        saveStatus,
        handleChange: saveDraft,
        handleDelete,
    } = useDraftFormAutosave({
        formKey: I3IssueItemsForm.formKey,
        instanceId,
        organizationId: organization.id,
        onDeleting: () => router.push(route("/orgs/[slug]/d4h-i3/forms/issue-items", { slug })),
    });

    function handleChange() {
        saveDraft(form.getValues());
    }

    const submitMutation = useMutation(
        trpc.i3.submitIssueItemsForm.mutationOptions({
            meta: { effects: i3Effects.submitIssueItemsForm, navigates: true },
            onError(error) {
                toast.error(`Form processing failed: ${error.message}`);
            },
            onSuccess() {
                toast.success("Form processed successfully.");

                router.push(route("/orgs/[slug]/d4h-i3/forms/issue-items", { slug }));
            },
        }),
    );

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
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    { label: "Forms" },
                    {
                        label: "Issue Items",
                        href: route("/orgs/[slug]/d4h-i3/forms/issue-items", { slug }),
                    },
                    { label: form.getValues().recipient.name || "No one selected" },
                ]}
                actions={<HelpButton id="d4h-i3/issue" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Issue Items</Saratoga.Title>
                    </Saratoga.Header>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Use this form to record items being issued to an individual.
                            </CardDescription>
                            <CardAction>
                                <SaveStatusIndicator status={saveStatus} />
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <form
                                id="item-issue-form"
                                onSubmit={handleSubmit}
                                onChange={handleChange}
                            >
                                <FieldGroup>
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <Controller
                                            control={form.control}
                                            name="recipient"
                                            render={({ field, fieldState }) => (
                                                <Field data-invalid={fieldState.invalid}>
                                                    <FieldLabel htmlFor="recipient">
                                                        Issued to
                                                    </FieldLabel>
                                                    <D4HTeamMemberSelect
                                                        value={field.value}
                                                        onChange={(value) => {
                                                            field.onChange(value);
                                                            handleChange();
                                                        }}
                                                        organizationId={organization.id}
                                                        id="recipient"
                                                        aria-invalid={fieldState.invalid}
                                                    />
                                                    {fieldState.error && (
                                                        <FieldError errors={[fieldState.error]} />
                                                    )}
                                                </Field>
                                            )}
                                        />
                                        <Field>
                                            <FieldLabel>Recorded by</FieldLabel>
                                            {/* Matches the height of the person select it sits beside. */}
                                            <UserNameFieldValue className="flex h-8 items-center text-sm" />
                                        </Field>
                                    </div>

                                    {lacksCreatePermission && (
                                        <Alert variant="warning">
                                            <AlertTitle>
                                                Can&apos;t issue items to this team
                                            </AlertTitle>
                                            <AlertDescription>
                                                Your D4H account doesn&apos;t have permission to
                                                create equipment in{" "}
                                                {recipientTeam?.title ?? "this person's team"}.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {/* An unreachable team trips both alerts; the permission one is enough. */}
                                    {fitsQuery.isError && !lacksCreatePermission && (
                                        <Alert variant="warning">
                                            <AlertTitle>
                                                Couldn&apos;t check templates against D4H
                                            </AlertTitle>
                                            <AlertDescription>
                                                Every template is offered. Submit still refuses any
                                                that can&apos;t be issued to {recipientTeamTitle}.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {checkingFits && (
                                        <p className="text-sm text-muted-foreground">
                                            Checking templates…
                                        </p>
                                    )}

                                    <FieldSeparator />

                                    <D4HI3_Issue_ItemsSection
                                        form={form}
                                        organizationId={organization.id}
                                        hasRecipient={recipient.id > 0}
                                        fits={fits}
                                        teamTitle={recipientTeamTitle}
                                        misfitIndexes={misfitIndexes}
                                        onChange={handleChange}
                                    />

                                    <FieldSeparator />

                                    <Controller
                                        control={form.control}
                                        name="comments"
                                        render={({ field, fieldState }) => (
                                            <Field data-invalid={fieldState.invalid}>
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
                                            disabled={
                                                lacksCreatePermission ||
                                                checkingFits ||
                                                misfitIndexes.length > 0
                                            }
                                            text={{
                                                idle: "Submit",
                                                pending: "Submitting",
                                                success: "Submitted",
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={handleDelete}
                                            className="text-destructive"
                                            aria-label="Delete draft"
                                        >
                                            <ObjectIcons.Delete />
                                        </Button>
                                    </Field>
                                </FieldGroup>
                            </form>
                        </CardContent>
                    </Card>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

/**
 * Section for managing the list of items being issued, including the "Add Item" dialog.
 */
function D4HI3_Issue_ItemsSection({
    form,
    organizationId,
    hasRecipient,
    fits,
    teamTitle,
    misfitIndexes,
    onChange,
}: {
    form: UseFormReturn<I3IssueItemsFormInputData>;
    organizationId: OrganizationId;
    hasRecipient: boolean;
    /** The templates and variants that fit the recipient's team, or `undefined` while unknown. */
    fits: TemplateFits | undefined;
    teamTitle: string;
    /** Indexes of the items that don't fit the recipient's team. */
    misfitIndexes: number[];
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
                <div className="text-sm font-medium">Issued Items</div>
                <div className="flex items-center gap-2">
                    {!hasRecipient && (
                        <span className="text-sm text-muted-foreground">
                            Choose who they&apos;re issued to first
                        </span>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!hasRecipient}
                        onClick={() => setTargetIndex("new")}
                    >
                        Add Item
                    </Button>
                </div>
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
                                {misfitIndexes.includes(index) && (
                                    <ItemDescription className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                                        <AlertWarningIcon className="size-3.5" />
                                        Can&apos;t be issued to {teamTitle}
                                    </ItemDescription>
                                )}
                            </ItemContent>
                            <ItemActions>
                                <ButtonGroup>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Edit item"
                                        onClick={() => setTargetIndex(index)}
                                    >
                                        <ObjectIcons.Edit />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Remove item"
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
                fits={fits}
                teamTitle={teamTitle}
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
                    fits={fits}
                    teamTitle={teamTitle}
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

/**
 * The ids of the templates and variants that fit the recipient's D4H team. Plain strings, since
 * the form's input values carry unbranded ids.
 */
interface TemplateFits {
    templateIds: ReadonlySet<string>;
    variantIds: ReadonlySet<string>;
}

/** Whether an issued item's template, and its variant if it has one, fit the recipient's team. */
function itemFits(item: I3IssuedItemInput, fits: TemplateFits) {
    return (
        fits.templateIds.has(item.template.id) &&
        (item.variant == null || fits.variantIds.has(item.variant.id))
    );
}

/**
 * The templates and variants to offer: those that fit, or all of them while fit is unknown.
 *
 * `keep` names an item's current template and variant, which stay on offer even when they don't
 * fit, so Edit Item still shows what the item is. `templateMisfit` and `variantMisfit` tell the
 * dialog which to mark.
 */
function offeredOptions(
    templates: I3Template[],
    variants: I3TemplateVariant[],
    fits: TemplateFits | undefined,
    keep: { templateId?: string; variantId?: string } = {},
) {
    if (!fits) {
        return {
            templateOptions: templates,
            variantOptions: variants,
            templateMisfit: () => false,
            variantMisfit: () => false,
        };
    }
    return {
        templateOptions: templates.filter(
            (template) => fits.templateIds.has(template.id) || template.id === keep.templateId,
        ),
        variantOptions: variants.filter(
            (variant) => fits.variantIds.has(variant.id) || variant.id === keep.variantId,
        ),
        templateMisfit: (id: string) => !fits.templateIds.has(id),
        variantMisfit: (id: string) => !fits.variantIds.has(id),
    };
}

/** Marks a kept template or variant that can't be issued to the recipient's team. */
function MisfitMarker({ teamTitle }: { teamTitle: string }) {
    const label = `Can't be issued to ${teamTitle}`;
    return (
        <span title={label} className="inline-flex">
            <AlertWarningIcon className="size-3.5 text-amber-600 dark:text-amber-500" />
            <span className="sr-only">{label}</span>
        </span>
    );
}

/**
 * Whether to say no variants fit, in place of an empty variant select: only when the template
 * has variants and none of them are on offer.
 */
function noVariantsFit(
    template: I3Template | undefined,
    variants: I3TemplateVariant[],
    offered: I3TemplateVariant[],
) {
    return (
        template != null &&
        offered.length === 0 &&
        variants.some((variant) => variant.templateId === template.id)
    );
}

interface ItemDialogFitProps {
    /** Every template and variant, for lookups. The dialog offers only those in `fits`. */
    templates: I3Template[];
    variants: I3TemplateVariant[];
    fits: TemplateFits | undefined;
    teamTitle: string;
}

interface AddItemDialogProps extends DialogProps, ItemDialogFitProps {
    onAdd: (item: I3IssuedItemInput) => void;
}

/**
 * Dialog for adding an item to the issue list.
 */
function AddItemDialog({
    onAdd,
    templates,
    variants,
    fits,
    teamTitle,
    ...props
}: AddItemDialogProps) {
    const { templateOptions, variantOptions } = offeredOptions(templates, variants, fits);

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
            console.warn("Unable to add item: ", error);
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
                <DialogBody>
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="template"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template">Template</FieldLabel>
                                    {templateOptions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No templates can be issued to {teamTitle}.
                                        </p>
                                    ) : (
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
                                            <SelectTrigger
                                                id="template"
                                                aria-invalid={fieldState.invalid}
                                            >
                                                <SelectValue placeholder="Select a template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templateOptions.map((template) => (
                                                    <SelectItem
                                                        key={template.id}
                                                        value={template.id}
                                                    >
                                                        {template.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="variant"
                            render={({ field, fieldState }) => {
                                const applicableVariants = currentTemplate
                                    ? variantOptions.filter(
                                          (variant) => variant.templateId === currentTemplate.id,
                                      )
                                    : [];

                                return (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="variant">Variant</FieldLabel>

                                        {noVariantsFit(
                                            currentTemplate,
                                            variants,
                                            applicableVariants,
                                        ) ? (
                                            <p className="text-sm text-muted-foreground">
                                                No variants can be issued to {teamTitle}.
                                            </p>
                                        ) : (
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
                                                        <SelectItem
                                                            key={variant.id}
                                                            value={variant.id}
                                                        >
                                                            {variant.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                );
                            }}
                        />
                        <Controller
                            control={form.control}
                            name="serialNumber"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
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
                </DialogBody>
                <DialogFooter>
                    <Button type="button" onClick={handleSubmit}>
                        Add
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface EditItemDialogProps extends DialogProps, ItemDialogFitProps {
    item: I3IssuedItemInput;
    onUpdate: (updatedItem: I3IssuedItemInput) => void;
}

function EditItemDialog({
    item,
    onUpdate,
    templates,
    variants,
    fits,
    teamTitle,
    ...props
}: EditItemDialogProps) {
    const { templateOptions, variantOptions, templateMisfit, variantMisfit } = offeredOptions(
        templates,
        variants,
        fits,
        {
            templateId: item.template.id,
            variantId: item.variant?.id,
        },
    );

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
            console.warn("Unable to update item: ", error);
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
                <DialogBody>
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="template"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="template">Template</FieldLabel>
                                    {templateOptions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No templates can be issued to {teamTitle}.
                                        </p>
                                    ) : (
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
                                            <SelectTrigger
                                                id="template"
                                                aria-invalid={fieldState.invalid}
                                            >
                                                <SelectValue placeholder="Select a template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templateOptions.map((template) => (
                                                    <SelectItem
                                                        key={template.id}
                                                        value={template.id}
                                                    >
                                                        {template.name}
                                                        {templateMisfit(template.id) && (
                                                            <MisfitMarker teamTitle={teamTitle} />
                                                        )}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="variant"
                            render={({ field, fieldState }) => {
                                const applicableVariants = currentTemplate
                                    ? variantOptions.filter(
                                          (variant) => variant.templateId === currentTemplate.id,
                                      )
                                    : [];

                                return (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="variant">Variant</FieldLabel>

                                        {noVariantsFit(
                                            currentTemplate,
                                            variants,
                                            applicableVariants,
                                        ) ? (
                                            <p className="text-sm text-muted-foreground">
                                                No variants can be issued to {teamTitle}.
                                            </p>
                                        ) : (
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
                                                        <SelectItem
                                                            key={variant.id}
                                                            value={variant.id}
                                                        >
                                                            {variant.name}
                                                            {variantMisfit(variant.id) && (
                                                                <MisfitMarker
                                                                    teamTitle={teamTitle}
                                                                />
                                                            )}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                );
                            }}
                        />
                        <Controller
                            control={form.control}
                            name="serialNumber"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
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
                </DialogBody>
                <DialogFooter>
                    <Button type="button" onClick={handleSubmit}>
                        Update
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
