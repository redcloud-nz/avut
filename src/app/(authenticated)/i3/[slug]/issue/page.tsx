/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /i3/[slug]/issue
 */

"use client";

import { PencilIcon, XIcon } from "lucide-react";
import { ComponentProps, Fragment, use, useState } from "react";
import { Controller, useFieldArray, useForm, UseFormReturn, useWatch } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useSuspenseQueries } from "@tanstack/react-query";

import { authQueries } from "@/client/auth-queries";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { AlertIcons } from "@/components/icons";
import { Alert, AlertTitle } from "@/components/ui/alert2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
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
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { IssuedItem, IssueItemsFormData, IssueItemsFormInputData } from "@/lib/schemas/i3-forms";
import { I3Template } from "@/lib/schemas/i3-template";
import { I3TemplateVariant } from "@/lib/schemas/i3-template-variant";
import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

export default function I3_Issue_Page(props: PageProps<"/i3/[slug]/issue">) {
    const { slug } = use(props.params);
    const organization = useOrganization();

    const form = useForm({
        resolver: zodResolver(IssueItemsFormData.schema),
        defaultValues: {
            recipient: { id: 0, name: "" },
            comments: "",
            items: [],
        },
    });

    const handleSubmit = form.handleSubmit(() => {});

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "I3", href: `/i3/${slug}` },
                    { label: "Issue", href: `/i3/${slug}/issue` },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton to={{ href: `/i3/${slug}` }} tooltip="Back to I3" />
                        <Hermes.Title>Issue Items</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Use this form to record items being issued to an individual.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form id="item-issue-form" onSubmit={handleSubmit}>
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
                                                <TeamMemberSelect
                                                    {...field}
                                                    organizationId={organization.id}
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
                                            </Field>
                                        )}
                                    />

                                    <FieldSeparator />

                                    <I3_Issue_ItemsSection
                                        form={form}
                                        organizationId={organization.id}
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
                                    <Field orientation="horizontal">
                                        <Button type="submit">Submit</Button>
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

interface TeamMemberSelectProps {
    value: IssueItemsFormInputData["recipient"];
    onChange: (value: IssueItemsFormInputData["recipient"]) => void;
    organizationId: OrganizationId;
    slotProps?: {
        content?: ComponentProps<typeof SelectContent>;
        trigger?: ComponentProps<typeof SelectTrigger>;
        value?: ComponentProps<typeof SelectValue>;
    };
}

function TeamMemberSelect({
    value,
    onChange,
    organizationId,
    slotProps = {},
}: TeamMemberSelectProps) {
    const [{ data: teams }, { data: members }] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.listTeams.queryOptions({
                organizationId: organizationId,
            }),
            trpc.d4hApi.listMembers.queryOptions({
                organizationId: organizationId,
            }),
        ],
    });

    function handleChange(newValue: string) {
        if (newValue === "") {
            onChange({ id: 0, name: "" });
        } else {
            const memberId = parseInt(newValue, 10);
            const selectedMember = members.find((member) => member.id === memberId);
            if (selectedMember) {
                onChange({ id: selectedMember.id, name: selectedMember.name });
            }
        }
    }

    return (
        <Select value={value.id == 0 ? "" : value.id + ""} onValueChange={handleChange}>
            <SelectTrigger {...slotProps.trigger}>
                <SelectValue {...slotProps.value} placeholder="Select a recipient" />
            </SelectTrigger>
            <SelectContent {...slotProps.content}>
                {teams
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((team, teamIndex) => {
                        const teamMembers = members.filter((member) => member.team.id === team.id);
                        if (teamMembers.length === 0) {
                            return null;
                        }

                        return (
                            <Fragment key={team.id}>
                                <SelectGroup>
                                    <SelectLabel>{team.title}</SelectLabel>
                                    {teamMembers
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map((member) => (
                                            <SelectItem key={member.id} value={member.id + ""}>
                                                {member.name}
                                            </SelectItem>
                                        ))}
                                </SelectGroup>
                                {teamIndex < teams.length - 1 && <SelectSeparator />}
                            </Fragment>
                        );
                    })}
            </SelectContent>
        </Select>
    );
}

/**
 * Section for managing the list of items being issued, including the "Add Item" dialog.
 */
function I3_Issue_ItemsSection({
    form,
    organizationId,
}: {
    form: UseFormReturn<IssueItemsFormInputData>;
    organizationId: OrganizationId;
}) {
    const [{ data: templates }, { data: variants }] = useSuspenseQueries({
        queries: [
            trpc.i3.listTemplates.queryOptions({ organizationId }),
            trpc.i3.listTemplateVariants.queryOptions({ organizationId }),
        ],
    });

    const [addItemDialogOpen, setAddItemDialogOpen] = useState<boolean>(false);

    const {
        fields: items,
        append: appendItem,
        update: updateItem,
        remove: removeItem,
    } = useFieldArray({
        control: form.control,
        name: "items",
    });

    return (
        <div className="flex flex-col gap-2">
            <FieldLegend>Issued Items</FieldLegend>

            <ItemGroup>
                {items.map((item, index) => {
                    const template = templates.find((template) => template.id === item.template.id);
                    const variant = item.variant
                        ? variants.find((variant) => variant.id === item.variant?.id)
                        : null;

                    return (
                        <Item variant="outline" size="sm" key={item.id}>
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
                                <Button type="button" variant="ghost" size="icon">
                                    <PencilIcon />
                                </Button>
                            </ItemActions>
                        </Item>
                    );
                })}
            </ItemGroup>

            <div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddItemDialogOpen(true)}
                >
                    Add Item
                </Button>
            </div>
            <AddItemDialog
                open={addItemDialogOpen}
                onOpenChange={setAddItemDialogOpen}
                templates={templates}
                variants={variants}
                onAdd={appendItem}
            />
        </div>
    );
}

interface AddItemDialogProps extends DialogProps {
    templates: I3Template[];
    variants: I3TemplateVariant[];
    onAdd: (item: IssueItemsFormInputData["items"][number]) => void;
}

/**
 * Dialog for adding an item to the issue list.
 */
function AddItemDialog({ onAdd, templates, variants, ...props }: AddItemDialogProps) {
    const form = useForm({
        resolver: zodResolver(IssuedItem.schema),
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
