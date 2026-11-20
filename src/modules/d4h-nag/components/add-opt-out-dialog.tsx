/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense, useId } from "react";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { d4hNagEffects } from "@/client/d4h-nag-effects";
import { ObjectIcons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/hooks/use-organization";
import { D4HNagOptOutData } from "@/lib/schemas/d4h-nag";
import { TeamId } from "@/lib/schemas/team";
import { describePausedReason } from "@/modules/d4h-nag/lib/paused-reason";
import { trpc } from "@/trpc/client";

const formSchema = D4HNagOptOutData.addSchema;

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;
type OptOutForm = UseFormReturn<FormInput, unknown, FormValues>;

/**
 * `?action=add-opt-out` — self-triggered (Recipe A): the trigger button lives here, and the dialog
 * stays mounted on the opt-outs list through the add. Pick a linked team, then one of its D4H
 * members, read through the module's D4H token.
 */
export function D4HNag_AddOptOut_Dialog() {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["add-opt-out"] as const),
    );
    const dialogOpen = action === "add-opt-out";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "add-opt-out" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Create />{" "}
                    <span className="sr-only md:not-sr-only">Add Opt-out</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Opt-out</DialogTitle>
                    <DialogDescription>
                        Stop sending attendance reminders to a member, on their behalf.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <AddOptOut_Body onDone={() => handleDialogOpenChange(false)} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function AddOptOut_Body({ onDone }: { onDone: () => void }) {
    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.d4hNag.listEligibleTeams.queryOptions({ organizationId: organization.id }),
    );

    const formId = useId();
    const teamFieldId = useId();
    const form: OptOutForm = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            teamId: teams.length === 1 ? teams[0].id : undefined,
            d4hMemberId: undefined,
            memberName: "",
        },
    });
    const watchedTeamId = useWatch({ control: form.control, name: "teamId" });
    // The form holds the select's raw value; every option is an eligible team's id.
    const teamId = watchedTeamId ? TeamId.schema.parse(watchedTeamId) : null;

    const mutation = useMutation(
        trpc.d4hNag.addOptOut.mutationOptions({
            meta: { effects: d4hNagEffects.addOptOut },
            onError(error) {
                console.error("Failed to add opt-out", error);
                toast.error(`Failed to add opt-out: ${error.message}`);
            },
            onSuccess({ created }) {
                toast.success(`${created.memberName} opted out of reminders`);
                onDone();
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => mutation.mutate({ organizationId: organization.id, ...formData }),
        (errors) => console.warn("Form validation errors:", errors),
    );

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="teamId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={teamFieldId}>Team</FieldLabel>
                                    <Select
                                        value={field.value ?? ""}
                                        onValueChange={(value) => {
                                            field.onChange(value || undefined);
                                            // A member belongs to one team's list; pick again.
                                            form.resetField("d4hMemberId");
                                            form.resetField("memberName");
                                        }}
                                        disabled={teams.length === 0}
                                    >
                                        <SelectTrigger
                                            id={teamFieldId}
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue placeholder="Select a team" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {teams.map((team) => (
                                                <SelectItem key={team.id} value={team.id}>
                                                    {team.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {teams.length === 0 && (
                                        <FieldDescription>
                                            No active teams are linked to D4H.
                                        </FieldDescription>
                                    )}
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        {teamId && (
                            <Suspense fallback={<Skeleton className="h-16 w-full" />}>
                                <MemberField key={teamId} form={form} teamId={teamId} />
                            </Suspense>
                        )}
                    </FieldGroup>
                </form>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="submit"
                    form={formId}
                    disabled={teams.length === 0}
                    status={mutation.status}
                    text={{ idle: "Add", pending: "Adding", success: "Added" }}
                />
            </DialogFooter>
        </>
    );
}

/**
 * The member picker for one team: its current D4H members, less those already opted out for it.
 * When the team can't be read through the module's D4H token, says why instead.
 */
function MemberField({ form, teamId }: { form: OptOutForm; teamId: TeamId }) {
    const organization = useOrganization();
    const memberFieldId = useId();

    const { data: result } = useSuspenseQuery(
        trpc.d4hNag.listTeamD4HMembers.queryOptions({ organizationId: organization.id, teamId }),
    );
    const { data: optOuts } = useSuspenseQuery(
        trpc.d4hNag.listOptOuts.queryOptions({ organizationId: organization.id }),
    );

    if (result.state === "not-runnable") {
        const { label, description } = describePausedReason(result.reason);
        return (
            <Alert variant="warning">
                <AlertTitle>Can&apos;t list this team&apos;s members: {label}</AlertTitle>
                <AlertDescription>{description}</AlertDescription>
            </Alert>
        );
    }

    const optedOut = new Set(
        optOuts.filter((optOut) => optOut.team.id === teamId).map((optOut) => optOut.d4hMemberId),
    );
    const members = result.members.filter((member) => !optedOut.has(member.d4hMemberId));

    return (
        <Controller
            name="d4hMemberId"
            control={form.control}
            render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={memberFieldId}>Member</FieldLabel>
                    <Select
                        value={field.value === undefined ? "" : String(field.value)}
                        onValueChange={(value) => {
                            const member = members.find((m) => String(m.d4hMemberId) === value);
                            field.onChange(member?.d4hMemberId);
                            form.setValue("memberName", member?.name ?? "");
                        }}
                        disabled={members.length === 0}
                    >
                        <SelectTrigger id={memberFieldId} aria-invalid={fieldState.invalid}>
                            <SelectValue placeholder="Select a member" />
                        </SelectTrigger>
                        <SelectContent>
                            {members.map((member) => (
                                <SelectItem
                                    key={member.d4hMemberId}
                                    value={String(member.d4hMemberId)}
                                >
                                    {member.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldDescription>
                        {result.members.length === 0
                            ? "The team's linked D4H team has no current members."
                            : members.length === 0
                              ? "Every current D4H member of this team has already opted out."
                              : "Current members of the team's linked D4H team."}
                    </FieldDescription>
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
            )}
        />
    );
}
