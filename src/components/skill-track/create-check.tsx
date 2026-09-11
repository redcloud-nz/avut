/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { SkillCheckResultIcon } from "@/components/skill-track/result-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { skillChecksEffects } from "@/client/skill-checks-effects";
import { useActionHotkeys } from "@/hooks/use-action-hotkeys";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import {
    getEnabledSkillCheckResultOptions,
    SkillCheckId,
    SkillCheckResultValue,
} from "@/lib/schemas/skill-check";
import { trpc } from "@/trpc/client";

const CreateCheckSchema = z.object({
    assesseeId: PersonId.schema,
    skillId: SkillId.schema,
    result: SkillCheckResultValue.schema,
    notes: z.string(),
});

export function SkillTrack_CreateCheck_Dialog() {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["create-check"] as const),
    );
    const dialogOpen = action === "create-check";

    const canCreateCheck = useHasPermission({ skillCheck: ["create"], person: ["view"] });
    useActionHotkeys([
        {
            verb: "create",
            run: () => void setAction("create-check", { history: "push" }),
            enabled: canCreateCheck,
            name: "Add check",
            category: "Checks",
        },
    ]);

    // The assessor is always the current user's linked person — mirrors the session
    // check-taking flow, where the recorder can't stand in for someone else.
    const personSelfQuery = useQuery(
        trpc.personnel.getPersonSelf.queryOptions(
            { organizationId: organization.id },
            { enabled: dialogOpen },
        ),
    );
    const personSelf = personSelfQuery.data;

    const personnelQuery = useQuery(
        trpc.personnel.listPersonnel.queryOptions(
            { organizationId: organization.id },
            { enabled: dialogOpen },
        ),
    );
    const personnelOptions = useMemo(
        () =>
            [...(personnelQuery.data ?? [])]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((person) => ({ value: person.id, label: person.name })),
        [personnelQuery.data],
    );

    const skillsQuery = useQuery(
        trpc.skills.listAssessableSkills.queryOptions(
            { organizationId: organization.id },
            { enabled: dialogOpen },
        ),
    );
    const skillOptions = useMemo(
        () =>
            [...(skillsQuery.data?.skills ?? [])]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((skill) => ({ value: skill.id, label: skill.name })),
        [skillsQuery.data],
    );

    const resultOptions = getEnabledSkillCheckResultOptions(organization.settings);

    const form = useForm({
        resolver: zodResolver(CreateCheckSchema),
        defaultValues: {
            assesseeId: undefined,
            skillId: undefined,
            result: undefined,
            notes: "",
        },
    });

    const mutation = useMutation(
        trpc.skillChecks.createSkillCheck.mutationOptions({
            meta: { effects: skillChecksEffects.createSkillCheck },
            onError(error) {
                console.error("Failed to add skill check", error);
                toast.error(`Failed to add skill check: ${error.message}`);
            },
            onSuccess() {
                toast.success("Skill check added");
                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        void setAction(open ? "create-check" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset();
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    // getPersonSelf returns null (not undefined) once loaded with no linked person.
    const hasNoLinkedPerson = personSelfQuery.isSuccess && personSelf === null;

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" aria-label="Add Check">
                    <ObjectIcons.Create />
                    <span className="hidden sm:inline">Add Check</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Skill Check</DialogTitle>
                    <DialogDescription>
                        Record a single skill check outside of a session — for an informal
                        observation or a historical result. You are recorded as the assessor.
                    </DialogDescription>
                </DialogHeader>
                {hasNoLinkedPerson ? (
                    <Alert variant="warning">
                        <AlertTitle>No linked person record</AlertTitle>
                        <AlertDescription>
                            Your account is not linked to a person record in this organization.
                            Contact an administrator to link your account before recording skill
                            checks.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <form
                        id="add-check-form"
                        onSubmit={form.handleSubmit(
                            (formData) => {
                                if (!personSelf) return;
                                mutation.mutate({
                                    organizationId: organization.id,
                                    skillCheckId: SkillCheckId.create(),
                                    sessionId: null,
                                    create: { ...formData, assessorId: personSelf.id },
                                });
                            },
                            (errors) => {
                                console.error("Form validation errors:", errors);
                            },
                        )}
                    >
                        <FieldGroup>
                            <Controller
                                name="assesseeId"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>Assessee</FieldLabel>
                                        <SearchableSelect
                                            value={field.value}
                                            onValueChange={(value) =>
                                                field.onChange((value as PersonId) || undefined)
                                            }
                                            options={personnelOptions}
                                            placeholder="Select a person"
                                            searchPlaceholder="Search personnel..."
                                            emptyMessage="No personnel found."
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="skillId"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>Skill</FieldLabel>
                                        <SearchableSelect
                                            value={field.value}
                                            onValueChange={(value) =>
                                                field.onChange((value as SkillId) || undefined)
                                            }
                                            options={skillOptions}
                                            placeholder="Select a skill"
                                            searchPlaceholder="Search skills..."
                                            emptyMessage="No assessable skills found."
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="result"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>Result</FieldLabel>
                                        <Select
                                            value={field.value ?? ""}
                                            onValueChange={(value) =>
                                                field.onChange(
                                                    (value as SkillCheckResultValue) || undefined,
                                                )
                                            }
                                        >
                                            <SelectTrigger aria-invalid={fieldState.invalid}>
                                                <SelectValue placeholder="Select a result" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {resultOptions.map((option) => (
                                                    <SelectItem
                                                        key={option.value}
                                                        value={option.value}
                                                    >
                                                        <SkillCheckResultIcon
                                                            result={option.value}
                                                        />
                                                        {option.label}
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
                                name="notes"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>Notes</FieldLabel>
                                        <Textarea {...field} placeholder="Notes" />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                    </form>
                )}
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    {!hasNoLinkedPerson && (
                        <MutationButton
                            type="submit"
                            form="add-check-form"
                            disabled={!personSelf}
                            status={mutation.status}
                            text={{
                                idle: "Add Check",
                                pending: "Adding...",
                                success: "Added",
                            }}
                        />
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
