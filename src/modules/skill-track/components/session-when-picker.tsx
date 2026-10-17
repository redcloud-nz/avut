/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { addDays, differenceInCalendarDays, format, parse } from "date-fns";
import { CalendarIcon, ClockIcon, PlusIcon, XIcon, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import * as z from "zod";

import { TZDate } from "@date-fns/tz";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

/** "00:00", "00:15", … "23:45". */
const QUARTER_HOURS = Array.from({ length: 96 }, (_, index) => {
    const hours = String(Math.floor(index / 4)).padStart(2, "0");
    const minutes = String((index % 4) * 15).padStart(2, "0");
    return `${hours}:${minutes}`;
});

/** How long a newly added time runs, in quarter hours: "+ Add time" and "+ Add end time" end 2h after the start. */
const DEFAULT_TIMED_QUARTERS = 8;

/** The quarter-hour time `quarters` after `time`, wrapping past midnight. */
function laterTime(time: string, quarters: number): string {
    const index = QUARTER_HOURS.indexOf(time);
    return QUARTER_HOURS[(index + quarters) % QUARTER_HOURS.length];
}

/** A tile: a bordered box holding an icon, a small label and the value. It's the trigger of its control. */
const TILE_CLASS = cn(
    "flex min-w-40 items-center gap-2.5 rounded-lg border border-input bg-transparent py-1.5 pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none",
    "hover:bg-accent aria-expanded:bg-accent",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
    "dark:bg-input/30 dark:hover:bg-input/50",
);

/** `SelectTrigger` fixes its height through `data-[size=default]`, so a tile overrides it there. */
const SELECT_TILE_CLASS = cn(TILE_CLASS, "data-[size=default]:h-auto");

/** A tile's icon, label and value, inside its trigger. */
function TileBody({
    icon: Icon,
    label,
    children,
}: {
    icon: LucideIcon;
    label: string;
    children: ReactNode;
}) {
    return (
        <>
            <Icon className="text-muted-foreground size-4 shrink-0" />
            <span className="flex flex-1 flex-col">
                <span className="text-muted-foreground text-xs">{label}</span>
                <span>{children}</span>
            </span>
        </>
    );
}

/**
 * A tile with a × that removes what it holds. The × sits over the trigger's right edge rather
 * than inside it, since a button can't nest in another; give the trigger `pr-9` to clear it.
 */
function RemovableTile({
    label,
    onRemove,
    children,
}: {
    label: string;
    onRemove: () => void;
    children: ReactNode;
}) {
    return (
        <div className="relative">
            {children}
            <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${label.toLowerCase()}`}
                className="absolute top-1/2 right-1.5 -translate-y-1/2"
                onClick={onRemove}
            >
                <XIcon />
            </Button>
        </div>
    );
}

/** A small primary-coloured "+ Add …" (or "Remove …") link under the tiles. */
function TileLink({
    onClick,
    plus = true,
    children,
}: {
    onClick: () => void;
    plus?: boolean;
    children: ReactNode;
}) {
    return (
        <Button type="button" variant="link" size="xs" className="h-auto px-0" onClick={onClick}>
            {plus && <PlusIcon />}
            {children}
        </Button>
    );
}

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
 * When a skill check session runs, as a row of tiles in the style of Facebook's event form: a
 * start date, then either an end date (all day over several days) or a start time and an
 * optional end time, all in the org's zone. Controlled over `SessionFormState`;
 * `sessionInstants` turns the value into what's stored.
 *
 * Which tiles show follows from the value alone, so an edit dialog opens on the right ones: End
 * date when an all-day session runs more than one day, the time tiles when it's timed, End time
 * when it has an end.
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
    const { display } = usePreferences();
    const timePattern = TIME_FORMAT_PATTERNS[display.timeFormat];
    const [openCalendar, setOpenCalendar] = useState<"start" | "end" | null>(null);

    // The days as local `Date`s, only for the calendars and for formatting: no instant is read from them.
    const day = parse(value.date, "yyyy-MM-dd", new Date());
    const lastDay = addDays(day, value.days - 1);

    const hasEndDate = value.allDay && value.days > 1;

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

    function calendarOpenChange(which: "start" | "end") {
        return (open: boolean) => setOpenCalendar(open ? which : null);
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
                <Popover open={openCalendar === "start"} onOpenChange={calendarOpenChange("start")}>
                    <PopoverTrigger
                        aria-label="Start date"
                        aria-invalid={invalid}
                        className={TILE_CLASS}
                    >
                        <TileBody icon={CalendarIcon} label="Start date">
                            {format(day, SESSION_DATE_PATTERN)}
                        </TileBody>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0">
                        <Calendar
                            mode="single"
                            selected={day}
                            defaultMonth={day}
                            captionLayout="dropdown"
                            required
                            onSelect={(selected) => {
                                update({ date: format(selected, "yyyy-MM-dd") });
                                setOpenCalendar(null);
                            }}
                            autoFocus
                        />
                    </PopoverContent>
                </Popover>

                {hasEndDate && (
                    <RemovableTile label="End date" onRemove={() => update({ days: 1 })}>
                        <Popover
                            open={openCalendar === "end"}
                            onOpenChange={calendarOpenChange("end")}
                        >
                            <PopoverTrigger
                                aria-label="End date"
                                aria-invalid={invalid}
                                className={cn(TILE_CLASS, "pr-9")}
                            >
                                <TileBody icon={CalendarIcon} label="End date">
                                    {format(lastDay, SESSION_DATE_PATTERN)}
                                </TileBody>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto overflow-hidden p-0">
                                <Calendar
                                    mode="single"
                                    selected={lastDay}
                                    defaultMonth={lastDay}
                                    required
                                    disabled={[
                                        { before: day },
                                        { after: addDays(day, MAX_DAYS - 1) },
                                    ]}
                                    onSelect={(selected) => {
                                        // Picking the start day itself makes it a one-day session again.
                                        update({
                                            days: differenceInCalendarDays(selected, day) + 1,
                                        });
                                        setOpenCalendar(null);
                                    }}
                                    autoFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </RemovableTile>
                )}

                {!value.allDay && (
                    <Select
                        value={value.startTime}
                        onValueChange={(startTime) => {
                            // Radix fires "" when it mounts or resets inside a form; that isn't a choice.
                            if (!startTime) return;
                            // Keep the session's length: the end moves with the start, as in a
                            // calendar app. The length is 1–95 quarters (an end never equals its
                            // start), so the moved end can't land on the new start either.
                            const length =
                                value.endTime === null
                                    ? null
                                    : (QUARTER_HOURS.indexOf(value.endTime) -
                                          QUARTER_HOURS.indexOf(value.startTime) +
                                          QUARTER_HOURS.length) %
                                      QUARTER_HOURS.length;
                            update({
                                startTime,
                                endTime: length ? laterTime(startTime, length) : null,
                            });
                        }}
                    >
                        <SelectTrigger
                            aria-label="Start time"
                            aria-invalid={invalid}
                            className={SELECT_TILE_CLASS}
                        >
                            <TileBody icon={ClockIcon} label="Start time">
                                <SelectValue />
                            </TileBody>
                        </SelectTrigger>
                        <SelectContent>
                            {QUARTER_HOURS.map((time) => (
                                <SelectItem key={time} value={time}>
                                    {timeLabel(time)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {!value.allDay && value.endTime != null && (
                    <RemovableTile label="End time" onRemove={() => update({ endTime: null })}>
                        <Select
                            value={value.endTime}
                            onValueChange={(endTime) => {
                                if (!endTime) return; // Radix's mount/reset "", as for the start time
                                update({ endTime });
                            }}
                        >
                            <SelectTrigger
                                aria-label="End time"
                                aria-invalid={invalid}
                                className={cn(SELECT_TILE_CLASS, "pr-9")}
                            >
                                <TileBody icon={ClockIcon} label="End time">
                                    <SelectValue />
                                </TileBody>
                            </SelectTrigger>
                            <SelectContent>
                                {endOptions.map(({ time, nextDay }) => (
                                    <SelectItem key={time} value={time}>
                                        {nextDay
                                            ? `${timeLabel(time)} (next day)`
                                            : timeLabel(time)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </RemovableTile>
                )}
            </div>

            <div className="flex flex-wrap gap-x-4">
                {value.allDay && !hasEndDate && (
                    <TileLink onClick={() => update({ days: 2 })}>Add end date</TileLink>
                )}
                {value.allDay && (
                    // An end date is all-day only, so adding a time clears it.
                    <TileLink
                        onClick={() =>
                            update({
                                allDay: false,
                                days: 1,
                                endTime: laterTime(value.startTime, DEFAULT_TIMED_QUARTERS),
                            })
                        }
                    >
                        Add time
                    </TileLink>
                )}
                {!value.allDay && value.endTime == null && (
                    <TileLink
                        onClick={() =>
                            update({ endTime: laterTime(value.startTime, DEFAULT_TIMED_QUARTERS) })
                        }
                    >
                        Add end time
                    </TileLink>
                )}
                {!value.allDay && (
                    <TileLink plus={false} onClick={() => update({ allDay: true, days: 1 })}>
                        Remove time
                    </TileLink>
                )}
            </div>

            <p className="text-muted-foreground text-xs">{zoneHint}</p>
        </div>
    );
}
