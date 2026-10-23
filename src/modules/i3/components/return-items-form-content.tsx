/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { i3Effects } from "@/client/i3-effects";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { D4HTeamMemberSelect } from "@/components/controls/d4h-team-member-select";
import { ObjectIcons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { I3ReturnedItem, I3ReturnItemsFormData } from "@/forms/i3-return-items/schema";
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { hasD4HTeamPermission } from "@/lib/d4h-permissions";
import { I3ReturnItemsForm } from "@/lib/forms";
import { route } from "@/lib/routes";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { OrganizationId } from "@/lib/schemas/organization";
import { useDraftFormAutosave, UserNameFieldValue } from "@/modules/i3/components/form-shared";
import { trpc } from "@/trpc/client";

function pluralItems(count: number) {
    return count === 1 ? "1 item" : `${count} items`;
}

/**
 * A draft Return Items form: who is returning, which of their items, comments, and Submit.
 */
export function I3Module_ReturnItems_FormInstance_Content({
    instanceId,
}: {
    instanceId: FormInstanceId;
}) {
    const logger = useLogger("I3Module", "ReturnItems_FormInstance_Content");
    const organization = useOrganization();
    const router = useRouter();

    const listHref = route("/orgs/[slug]/d4h-i3/forms/return-items", { slug: organization.slug });

    const [{ data: instances }, { data: accessibleTeams }] = useSuspenseQueries({
        queries: [
            trpc.forms.listDraftFormInstances.queryOptions({
                organizationId: organization.id,
                formKey: I3ReturnItemsForm.formKey,
            }),
            trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
        ],
    });

    const instance = instances.find((inst) => inst.id === instanceId);
    if (!instance) throw new Error(`FormInstance(${instanceId}) not found`);

    const form = useForm({
        resolver: zodResolver(I3ReturnItemsFormData.schema),
        values: instance.formData as I3ReturnItemsFormData,
    });

    const recipient = useWatch({ control: form.control, name: "recipient" });

    const recipientTeam = accessibleTeams.find((team) => team.id === recipient.teamId);
    const lacksUpdatePermission =
        recipient.id > 0 &&
        !hasD4HTeamPermission(recipientTeam?.permissions, "Equipment", "UPDATE");

    const {
        saveStatus,
        handleChange: saveDraft,
        handleDelete,
    } = useDraftFormAutosave({
        formKey: I3ReturnItemsForm.formKey,
        instanceId,
        organizationId: organization.id,
        onDeleting: () => router.push(listHref),
    });

    function handleChange() {
        saveDraft(form.getValues());
    }

    const submitMutation = useMutation(
        trpc.i3.submitReturnItemsForm.mutationOptions({
            meta: { effects: i3Effects.submitReturnItemsForm, navigates: true },
            onError(error) {
                toast.error(`Form processing failed: ${error.message}`);
            },
            onSuccess({ returned, failures }) {
                if (failures.length > 0) {
                    toast.warning(`Returned ${pluralItems(returned)}; ${failures.length} failed.`, {
                        description: failures.join("\n"),
                    });
                } else {
                    toast.success(`Returned ${pluralItems(returned)}.`);
                }

                router.push(listHref);
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
                    {
                        label: "D4H I3",
                        href: route("/orgs/[slug]/d4h-i3", { slug: organization.slug }),
                    },
                    { label: "Forms" },
                    { label: "Return Items", href: listHref },
                    { label: recipient.name || "No one selected" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Return Items</Saratoga.Title>
                    </Saratoga.Header>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Use this form to record items being returned by an individual.
                            </CardDescription>
                            <CardAction>
                                <SaveStatusIndicator status={saveStatus} />
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <form
                                id="item-return-form"
                                onSubmit={handleSubmit}
                                onChange={handleChange}
                            >
                                <FieldGroup>
                                    <Controller
                                        control={form.control}
                                        name="recipient"
                                        render={({ field, fieldState }) => (
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel htmlFor="recipient">
                                                    Returned by
                                                </FieldLabel>
                                                <D4HTeamMemberSelect
                                                    value={field.value}
                                                    onChange={(value) => {
                                                        field.onChange(value);
                                                        // The checklist is the chosen person's items.
                                                        form.setValue("items", []);
                                                        handleChange();
                                                    }}
                                                    organizationId={organization.id}
                                                    slotProps={{
                                                        trigger: {
                                                            id: "recipient",
                                                            "aria-invalid": fieldState.invalid,
                                                        },
                                                        value: {
                                                            placeholder: "Select a person",
                                                        },
                                                    }}
                                                />
                                                {fieldState.error && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />

                                    {lacksUpdatePermission && (
                                        <Alert variant="warning">
                                            <AlertTitle>
                                                Can&apos;t return items for this team
                                            </AlertTitle>
                                            <AlertDescription>
                                                Your D4H account doesn&apos;t have permission to
                                                update equipment in{" "}
                                                {recipientTeam?.title ?? "this person's team"}.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <FieldSeparator />

                                    <Controller
                                        control={form.control}
                                        name="items"
                                        render={({ field, fieldState }) => (
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel>Returned Items</FieldLabel>
                                                {recipient.id > 0 ? (
                                                    <Suspense
                                                        fallback={<Skeleton className="h-16" />}
                                                    >
                                                        <I3_Return_ItemChecklist
                                                            organizationId={organization.id}
                                                            teamId={recipient.teamId}
                                                            memberId={recipient.id}
                                                            value={field.value}
                                                            onChange={(items) => {
                                                                field.onChange(items);
                                                                handleChange();
                                                            }}
                                                        />
                                                    </Suspense>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">
                                                        Choose who is returning to see their items.
                                                    </p>
                                                )}
                                                {fieldState.error && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
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

                                    <Field>
                                        <FieldLabel>Received by</FieldLabel>
                                        <UserNameFieldValue />
                                    </Field>

                                    <Field orientation="horizontal" className="justify-between">
                                        <MutationButton
                                            type="submit"
                                            status={submitMutation.status}
                                            disabled={lacksUpdatePermission}
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
 * The returning person's current items, as a checklist. Items with an open Retire task (already
 * returned, waiting to be retired in D4H) are left out.
 */
function I3_Return_ItemChecklist({
    organizationId,
    teamId,
    memberId,
    value,
    onChange,
}: {
    organizationId: OrganizationId;
    teamId: number;
    memberId: number;
    value: I3ReturnedItem[];
    onChange: (items: I3ReturnedItem[]) => void;
}) {
    const [{ data: memberEquipment }, { data: returnedItemIds }] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.listMemberEquipment.queryOptions({ organizationId, teamId, memberId }),
            trpc.d4hTasks.listReturnedItemIds.queryOptions({ organizationId, teamId }),
        ],
    });

    const returnedIds = new Set(returnedItemIds);

    const items = memberEquipment
        .filter((item) => !returnedIds.has(item.id))
        .sort((a, b) => a.kind.title.localeCompare(b.kind.title) || a.ref.localeCompare(b.ref));

    // A saved tick can point at an item that's no longer listed (returned since, or no longer
    // theirs). Keep only the ticks the person can see, so hidden items aren't submitted.
    const displayedIds = new Set(items.map((item) => item.id));
    const visibleValue = value.filter((v) => displayedIds.has(v.itemId));
    const hasHiddenTicks = visibleValue.length !== value.length;

    useEffect(() => {
        if (hasHiddenTicks) onChange(visibleValue);
    }, [hasHiddenTicks, visibleValue, onChange]);

    const selectedIds = new Set(visibleValue.map((item) => item.itemId));

    if (items.length === 0) {
        return <p className="text-sm text-muted-foreground">No items to return.</p>;
    }

    return (
        <ItemGroup>
            {items.map((item) => {
                const checkboxId = `return-item-${item.id}`;
                return (
                    <Item size="sm" key={item.id} asChild>
                        <label htmlFor={checkboxId}>
                            <Checkbox
                                id={checkboxId}
                                checked={selectedIds.has(item.id)}
                                onCheckedChange={(checked) => {
                                    onChange(
                                        checked === true
                                            ? [
                                                  ...visibleValue,
                                                  {
                                                      itemId: item.id,
                                                      ref: item.ref,
                                                      kindTitle: item.kind.title,
                                                  },
                                              ]
                                            : visibleValue.filter((v) => v.itemId !== item.id),
                                    );
                                }}
                            />
                            <ItemContent>
                                <ItemTitle>
                                    #{item.ref} {item.kind.title}
                                </ItemTitle>
                                {item.serial && (
                                    <ItemDescription>S/N: {item.serial}</ItemDescription>
                                )}
                            </ItemContent>
                        </label>
                    </Item>
                );
            })}
        </ItemGroup>
    );
}
