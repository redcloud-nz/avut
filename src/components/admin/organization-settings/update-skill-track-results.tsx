/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Fragment, useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import { ObjectIcons } from "@/components/icons";
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
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSeparator,
    FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import {
    defaultSkillCheckResultLabel,
    SkillCheckResultValue,
} from "@/lib/schemas/skill-check-result";

import { SKILL_TRACK_RESULT_GROUPS } from "./skill-track-result-groups";
import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

/**
 * The settings schema's result config, with a message a person can act on (the shared schema's
 * default for a cleared label is Zod's "Too small…"). A label is only required while its result is
 * switched on: a switched-off result's input is disabled, so an error there couldn't be fixed.
 */
const resultFormSchema = z
    .object({ enabled: z.boolean(), label: z.string() })
    .refine((result) => !result.enabled || result.label.trim() !== "", {
        error: "Enter a label",
        path: ["label"],
    });

/** All ten result keys, including the ones not offered yet, which pass through untouched. */
const resultsFormSchema = z.object({
    results: z.record(SkillCheckResultValue.schema, resultFormSchema),
});

/**
 * `?action=update-skill-track-results` — self-triggered (Recipe A): the trigger button lives here.
 * Safe because saving the result options leaves the Skill Track module enabled, so its card keeps
 * rendering this trigger and the dialog stays mounted through the save.
 *
 * Patches only `results`, leaving `enabled` alone. A slice patch is partial only one level down,
 * so `results` goes whole: the form holds all ten result keys, and the ones not offered yet
 * (Exempt, Expired, Provisional) pass through untouched.
 */
export function OrganizationSettings_UpdateSkillTrackResults_Dialog({
    organizationId,
    settings,
    description,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    /** The result-options explanation, shared with the card's sub-heading. */
    description: string;
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-skill-track-results"] as const),
    );
    const dialogOpen = action === "update-skill-track-results";

    const form = useForm({
        resolver: zodResolver(resultsFormSchema),
        defaultValues: { results: settings.modules["skill-track"].results },
    });

    const results = useWatch({ control: form.control, name: "results" });

    const mutation = useOrganizationSettingsMutation({
        errorMessage: "Failed to update Skill Track result options",
        onSaved: (updated) => {
            form.reset({ results: updated.modules["skill-track"].results });
            handleDialogOpenChange(false);
        },
    });

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-skill-track-results" : null, {
            history: open ? "push" : "replace",
        });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ results: settings.modules["skill-track"].results });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        ({ results }) => {
            // The settings schema needs a non-empty label even on a switched-off result, so a
            // label cleared there falls back to the stored one (or the default name).
            const stored = settings.modules["skill-track"].results;
            const patchResults = Object.fromEntries(
                Object.entries(results).map(([key, result]) => {
                    const value = key as SkillCheckResultValue;
                    const label =
                        result.label.trim() !== ""
                            ? result.label.trim()
                            : stored[value].label || defaultSkillCheckResultLabel(value);
                    return [value, { ...result, label }];
                }),
            ) as typeof results;
            mutation.mutate({
                organizationId,
                update: { slice: "modules.skill-track", patch: { results: patchResults } },
            });
        },
        (errors) => console.error("Form validation errors:", errors),
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit skill check result options">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle>Skill Check Result Options</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id="update-skill-track-results-form" onSubmit={handleSubmit}>
                        <FieldGroup>
                            {SKILL_TRACK_RESULT_GROUPS.map((group, index) => (
                                <Fragment key={group.label}>
                                    {index > 0 && <FieldSeparator />}
                                    <FieldSet>
                                        <FieldLegend>{group.label}</FieldLegend>
                                        <FieldGroup>
                                            {group.values.map((value) => {
                                                const name = defaultSkillCheckResultLabel(value);
                                                return (
                                                    <Controller
                                                        key={value}
                                                        control={form.control}
                                                        name={`results.${value}.label`}
                                                        render={({ field, fieldState }) => (
                                                            <Field
                                                                data-invalid={fieldState.invalid}
                                                            >
                                                                <FieldLabel
                                                                    htmlFor={`skill-check-result-${value}-label`}
                                                                >
                                                                    {name}
                                                                </FieldLabel>
                                                                <div className="flex items-center gap-3">
                                                                    <Controller
                                                                        control={form.control}
                                                                        name={`results.${value}.enabled`}
                                                                        render={({
                                                                            field: enabledField,
                                                                        }) => (
                                                                            <Switch
                                                                                id={`skill-check-result-${value}-enabled`}
                                                                                aria-label={`Offer ${name}`}
                                                                                checked={
                                                                                    enabledField.value
                                                                                }
                                                                                onCheckedChange={
                                                                                    enabledField.onChange
                                                                                }
                                                                            />
                                                                        )}
                                                                    />
                                                                    <Input
                                                                        id={`skill-check-result-${value}-label`}
                                                                        className="min-w-0 flex-1"
                                                                        aria-invalid={
                                                                            fieldState.invalid
                                                                        }
                                                                        disabled={
                                                                            !results?.[value]
                                                                                ?.enabled
                                                                        }
                                                                        value={field.value}
                                                                        onChange={field.onChange}
                                                                    />
                                                                </div>
                                                                {fieldState.error && (
                                                                    <FieldError
                                                                        errors={[fieldState.error]}
                                                                    />
                                                                )}
                                                            </Field>
                                                        )}
                                                    />
                                                );
                                            })}
                                        </FieldGroup>
                                    </FieldSet>
                                </Fragment>
                            ))}
                        </FieldGroup>
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-skill-track-results-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
