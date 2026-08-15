/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DatePicker } from "@/components/controls/date-picker";
import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { skillsInvalidations } from "@/client/skills-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckSession, SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillTrack_CreateSession_Dialog() {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const [open, setOpen] = useState(false);

    const nextSessionNumberQuery = useQuery(
        trpc.skills.nextSessionNumber.queryOptions(
            { organizationId: organization.id },
            { enabled: open },
        ),
    );
    const namePlaceholder = nextSessionNumberQuery.data
        ? `Session #${nextSessionNumberQuery.data.nextSessionNumber}`
        : "Session Name";

    const form = useForm({
        resolver: zodResolver(SkillCheckSession.modifiableSchema),
        defaultValues: {
            name: "",
            date: new Date().toISOString(),
            notes: "",
            status: "Draft" as const,
        },
    });

    const mutation = useMutation(
        trpc.skills.createSession.mutationOptions({
            meta: { invalidates: skillsInvalidations.createSession },
            onError(error) {
                console.error("Failed to create session", error);
                toast.error(`Failed to create session ${error.message}`);
            },
            onSuccess({ created }) {
                toast.success("Session created");

                handleOpenChange(false);

                queryClient.setQueryData(
                    trpc.skills.getSession.queryKey({ skillCheckSessionId: created.id }),
                    created,
                );

                router.push(
                    route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                        slug: organization.slug,
                        session_id: created.id,
                    }),
                );
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }

        setOpen(open);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Create />
                    <span className="hidden sm:inline">New Session</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Session</DialogTitle>
                    <DialogDescription>
                        Create a new skill check session. You can add skill checks to the session
                        after it&apos;s created.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="new-session-form"
                    onSubmit={form.handleSubmit((formData) =>
                        mutation.mutate({
                            organizationId: organization.id,
                            skillCheckSessionId: SkillCheckSessionId.create(),
                            create: formData,
                        }),
                    )}
                >
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Name</FieldLabel>
                                    <Input {...field} placeholder={namePlaceholder} />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="date"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Date</FieldLabel>
                                    <DatePicker
                                        value={field.value}
                                        onValueChange={(newValue) => field.onChange(newValue)}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />

                        <Controller
                            name="notes"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Notes</FieldLabel>
                                    <Textarea {...field} placeholder="Session Notes" />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="new-session-form"
                        status={mutation.status}
                        text={{
                            idle: "Create",
                            pending: "Creating...",
                            success: "Created",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
