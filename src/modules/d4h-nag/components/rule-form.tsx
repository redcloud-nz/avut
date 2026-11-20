/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useId } from "react";
import { Controller, type Control } from "react-hook-form";
import * as z from "zod";

import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/hooks/use-organization";
import { numberInputProps } from "@/lib/number-input";
import { D4HNagRuleData, type D4HNagEligibleTeam } from "@/lib/schemas/d4h-nag";
import { TeamId } from "@/lib/schemas/team";

/**
 * A rule's fields as its create and update dialogs edit them. `teamId` is always present so both
 * dialogs share one form shape; only the create dialog lets it be picked.
 */
export const D4HNagRuleFormSchema = D4HNagRuleData.schema
    .pick({ weekday: true, hour: true, lookAheadHours: true, message: true })
    .extend({ teamId: TeamId.schema });

export type D4HNagRuleFormInput = z.input<typeof D4HNagRuleFormSchema>;

export type D4HNagRuleFormValues = z.output<typeof D4HNagRuleFormSchema>;

/** Monday first, as a week reads in NZ; values are `Date.getDay()` numbers (Sunday = 0). */
const WEEKDAY_OPTIONS = [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
    { value: 0, label: "Sunday" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: `${String(hour).padStart(2, "0")}:00`,
}));

/**
 * The fields of a rule's form, without the `<form>` itself. Pass `teams` to show the team picker
 * (creating a rule); leave it out when the team is fixed (updating one).
 */
export function D4HNag_RuleFormFields({
    control,
    teams,
}: {
    control: Control<D4HNagRuleFormInput, unknown, D4HNagRuleFormValues>;
    teams?: D4HNagEligibleTeam[];
}) {
    const organization = useOrganization();
    const timeZone = organization.settings.general.timeZone;

    const teamId = useId();
    const weekdayId = useId();
    const hourId = useId();
    const lookAheadId = useId();
    const messageId = useId();

    return (
        <FieldGroup>
            {teams && (
                <Controller
                    name="teamId"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={teamId}>Team</FieldLabel>
                            <Select
                                value={field.value ?? ""}
                                onValueChange={(value) => field.onChange(value || undefined)}
                                disabled={teams.length === 0}
                            >
                                <SelectTrigger id={teamId} aria-invalid={fieldState.invalid}>
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
                            <FieldDescription>
                                {teams.length === 0
                                    ? "No active teams are linked to D4H. Link a team to its D4H team from the team's page first."
                                    : "Members of the team's linked D4H team are reminded."}
                            </FieldDescription>
                            {fieldState.error && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
            )}
            <div className="grid grid-cols-2 gap-4">
                <Controller
                    name="weekday"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={weekdayId}>Day</FieldLabel>
                            <Select
                                value={String(field.value)}
                                onValueChange={(value) => field.onChange(Number(value))}
                            >
                                <SelectTrigger id={weekdayId} aria-invalid={fieldState.invalid}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {WEEKDAY_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={String(option.value)}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldState.error && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
                <Controller
                    name="hour"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={hourId}>Time</FieldLabel>
                            <Select
                                value={String(field.value)}
                                onValueChange={(value) => field.onChange(Number(value))}
                            >
                                <SelectTrigger id={hourId} aria-invalid={fieldState.invalid}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {HOUR_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={String(option.value)}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldState.error && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
                <FieldDescription className="col-span-2">
                    When the reminders go out each week, in the organisation&apos;s time zone (
                    {timeZone}).
                </FieldDescription>
            </div>
            <Controller
                name="lookAheadHours"
                control={control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={lookAheadId}>Look ahead</FieldLabel>
                        <InputGroup aria-invalid={fieldState.invalid}>
                            <InputGroupInput
                                id={lookAheadId}
                                type="number"
                                min={1}
                                max={168}
                                {...numberInputProps(field)}
                                aria-invalid={fieldState.invalid}
                            />
                            <InputGroupAddon align="inline-end">
                                <InputGroupText>hours</InputGroupText>
                            </InputGroupAddon>
                        </InputGroup>
                        <FieldDescription>
                            Exercises starting from an hour after the reminder time up to this many
                            hours after it are included. At most 168 (a week).
                        </FieldDescription>
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                    </Field>
                )}
            />
            <Controller
                name="message"
                control={control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={messageId}>Message</FieldLabel>
                        <Textarea
                            id={messageId}
                            placeholder="Optional"
                            aria-invalid={fieldState.invalid}
                            {...field}
                        />
                        <FieldDescription>
                            Added to the reminder email, as plain text.
                        </FieldDescription>
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                    </Field>
                )}
            />
        </FieldGroup>
    );
}
