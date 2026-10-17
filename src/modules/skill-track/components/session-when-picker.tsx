/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { addDays, format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useId, useMemo } from "react";
import * as z from "zod";

import { TZDate } from "@date-fns/tz";

import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePreferences } from "@/hooks/use-preferences";
import { TIME_FORMAT_PATTERNS } from "@/lib/datetime";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import {
    DEFAULT_SESSION_START_TIME,
    SESSION_DATE_PATTERN,
    sessionInstants,
    zoneAbbreviation,
    type SessionFormState,
} from "@/lib/session-timing";
import { cn } from "@/lib/utils";

const MAX_DAYS = 14;

/** The `Select` value standing in for "no end time" (Radix refuses an empty-string item value). */
const NO_END_TIME = "none";

/** "00:00", "00:15", … "23:45". */
const QUARTER_HOURS = Array.from({ length: 96 }, (_, index) => {
    const hours = String(Math.floor(index / 4)).padStart(2, "0");
    const minutes = String((index % 4) * 15).padStart(2, "0");
    return `${hours}:${minutes}`;
});

/** The picker's state in a form. An end time equal to the start time isn't a session (`sessionInstants` refuses it). */
export const sessionWhenSchema = z
    .object({
        date: z.iso.date(),
        allDay: z.boolean(),
        days: z.number().int().min(1).max(MAX_DAYS),
        startTime: z.string(),
        endTime: z.string().nullable(),
    })
    .refine((state) => state.allDay || state.endTime !== state.startTime, {
        error: "The end time can't be the same as the start time",
    });

/**
 * The create and update session dialogs' form: the picker's state in place of `startsAt`/`endsAt`,
 * which `sessionInstants` derives on submit.
 */
export const sessionDialogSchema = SkillCheckSession.modifiableSchema
    .pick({ name: true, notes: true })
    .extend({ when: sessionWhenSchema });

/** A new session's picker state: today in the org's zone, all day. */
export function defaultSessionWhen(orgZone: string): SessionFormState {
    return {
        date: format(new TZDate(new Date(), orgZone), "yyyy-MM-dd"),
        allDay: true,
        days: 1,
        startTime: DEFAULT_SESSION_START_TIME,
        endTime: null,
    };
}

/**
 * When a skill check session runs: a start date, then either a number of whole days or a start
 * time and an optional end time, all in the org's zone. Controlled over `SessionFormState`;
 * `sessionInstants` turns the value into what's stored.
 */
export function SkillTrack_SessionWhenPicker({
    value,
    onChange,
    orgZone,
    invalid,
}: {
    value: SessionFormState;
    onChange: (value: SessionFormState) => void;
    orgZone: string;
    invalid?: boolean;
}) {
    const id = useId();
    const { display } = usePreferences();
    const timePattern = TIME_FORMAT_PATTERNS[display.timeFormat];

    // The day as a local `Date`, only for the calendar and for formatting: no instant is read from it.
    const day = parse(value.date, "yyyy-MM-dd", new Date());

    const timeLabel = (time: string) => format(parse(time, "HH:mm", new Date()), timePattern);

    // The end options run from just after the start round to just before it, so the list reads
    // in order; those that wrap past midnight end the next day.
    const endOptions = useMemo(() => {
        const startIndex = QUARTER_HOURS.indexOf(value.startTime);
        return QUARTER_HOURS.slice(startIndex + 1)
            .map((time) => ({ time, nextDay: false }))
            .concat(QUARTER_HOURS.slice(0, startIndex).map((time) => ({ time, nextDay: true })));
    }, [value.startTime]);

    const zoneHint = useMemo(() => {
        // Only the start matters here, so ask for a timed one with no end. It renders on every
        // keystroke, so a half-formed value falls back to the bare zone rather than throwing.
        try {
            const { startsAt } = sessionInstants(
                { ...value, allDay: false, endTime: null },
                orgZone,
            );
            return `Times in ${orgZone} (${zoneAbbreviation(new Date(startsAt), orgZone)})`;
        } catch {
            return `Times in ${orgZone}`;
        }
    }, [value, orgZone]);

    function update(patch: Partial<SessionFormState>) {
        onChange({ ...value, ...patch });
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Popover>
                    <PopoverTrigger
                        id={`${id}-date`}
                        aria-label="Start date"
                        aria-invalid={invalid}
                        className={cn(
                            "border-input flex h-8 w-fit items-center justify-between gap-2 border bg-transparent pr-2 pl-2.5 py-2 text-xs whitespace-nowrap transition-colors outline-none",
                            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                            "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
                        )}
                    >
                        {format(day, SESSION_DATE_PATTERN)}
                        <CalendarIcon className="size-4 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0">
                        <Calendar
                            mode="single"
                            selected={day}
                            defaultMonth={day}
                            captionLayout="dropdown"
                            required
                            onSelect={(selected) =>
                                update({ date: format(selected, "yyyy-MM-dd") })
                            }
                            autoFocus
                        />
                    </PopoverContent>
                </Popover>
                <div className="flex items-center gap-2">
                    <Switch
                        id={`${id}-all-day`}
                        checked={value.allDay}
                        onCheckedChange={(allDay) => update({ allDay })}
                    />
                    <Label htmlFor={`${id}-all-day`}>All day</Label>
                </div>
            </div>

            {value.allDay ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Select
                        value={String(value.days)}
                        // Radix fires "" when it mounts or resets inside a form; that isn't a choice.
                        onValueChange={(days) => {
                            if (days) update({ days: Number(days) });
                        }}
                    >
                        <SelectTrigger aria-label="Number of days" aria-invalid={invalid}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: MAX_DAYS }, (_, index) => index + 1).map(
                                (days) => (
                                    <SelectItem key={days} value={String(days)}>
                                        {days === 1 ? "1 day" : `${days} days`}
                                    </SelectItem>
                                ),
                            )}
                        </SelectContent>
                    </Select>
                    {value.days > 1 && (
                        <span className="text-muted-foreground text-xs">
                            Last day {format(addDays(day, value.days - 1), SESSION_DATE_PATTERN)}
                        </span>
                    )}
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={value.startTime}
                        onValueChange={(startTime) => {
                            if (!startTime) return; // Radix's mount/reset "", as for `days`
                            // An end equal to the new start isn't on offer: drop it.
                            update({
                                startTime,
                                endTime: value.endTime === startTime ? null : value.endTime,
                            });
                        }}
                    >
                        <SelectTrigger aria-label="Start time" aria-invalid={invalid}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {QUARTER_HOURS.map((time) => (
                                <SelectItem key={time} value={time}>
                                    {timeLabel(time)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-muted-foreground text-xs">to</span>
                    <Select
                        value={value.endTime ?? NO_END_TIME}
                        onValueChange={(endTime) => {
                            if (!endTime) return; // Radix's mount/reset "", as for `days`
                            update({ endTime: endTime === NO_END_TIME ? null : endTime });
                        }}
                    >
                        <SelectTrigger aria-label="End time" aria-invalid={invalid}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_END_TIME}>No end time</SelectItem>
                            {endOptions.map(({ time, nextDay }) => (
                                <SelectItem key={time} value={time}>
                                    {nextDay ? `${timeLabel(time)} (next day)` : timeLabel(time)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <p className="text-muted-foreground text-xs">{zoneHint}</p>
        </div>
    );
}
