/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { addDays, differenceInCalendarDays, format, parse } from "date-fns";
import { CalendarIcon, ClockIcon, type LucideIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
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
import {
    SkillCheckSession,
    type ModifiableSkillCheckSession,
} from "@/lib/schemas/skill-check-session";
import {
    DEFAULT_SESSION_START_TIME,
    MAX_SESSION_DAYS,
    SESSION_DATE_PATTERN,
    sessionInstants,
    zoneAbbreviation,
    type SessionFormState,
} from "@/lib/session-timing";
import { cn } from "@/lib/utils";

/** "00:00", "00:15", … "23:45". */
const QUARTER_HOURS = Array.from({ length: 96 }, (_, index) => {
    const hours = String(Math.floor(index / 4)).padStart(2, "0");
    const minutes = String((index % 4) * 15).padStart(2, "0");
    return `${hours}:${minutes}`;
});

/** How long a newly timed session runs, in quarter hours: turning off "All day" ends it 2h after the start. */
const DEFAULT_TIMED_QUARTERS = 8;

/** The quarter-hour time `quarters` after `time`, wrapping past midnight. */
function laterTime(time: string, quarters: number): string {
    const index = QUARTER_HOURS.indexOf(time);
    return QUARTER_HOURS[(index + quarters) % QUARTER_HOURS.length];
}

/** A tile: a bordered box holding an icon, a small label and the value. It's the trigger of its control. */
const TILE_CLASS = cn(
    "flex w-full min-w-0 items-center gap-2.5 rounded-lg border border-input bg-transparent py-1.5 pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none",
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
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-muted-foreground text-xs">{label}</span>
                <span className="truncate">{children}</span>
            </span>
        </>
    );
}

/**
 * Each tile's fixed cell in the 2×2 grid, so a tile stays put whether or not the others show:
 * dates in the first column, times in the second.
 */
const TILE_CELL = {
    startDate: "col-start-1 row-start-1",
    startTime: "col-start-2 row-start-1",
    endDate: "col-start-1 row-start-2",
    endTime: "col-start-2 row-start-2",
} as const;

/**
 * The picker's state in a form. `sessionInstants` refuses a one-day session ending at its start
 * time. The picker always gives a timed session an end time, though `sessionInstants` (and
 * sessions stored before it did) allow none.
 */
export const sessionWhenSchema = z
    .object({
        date: z.iso.date(),
        allDay: z.boolean(),
        days: z.number().int().min(1).max(MAX_SESSION_DAYS),
        startTime: z.string(),
        endTime: z.string().nullable(),
    })
    .refine((state) => state.allDay || state.endTime != null, {
        error: "A session with times needs an end time",
    })
    .refine((state) => state.allDay || state.days > 1 || state.endTime !== state.startTime, {
        error: "The end time can't be the same as the start time",
    });

/**
 * `state` with an end time when it's timed: a stored timed session with no end gets one 2h after
 * its start, so the picker opens on a value it can save.
 */
export function withSessionEndTime(state: SessionFormState): SessionFormState {
    if (state.allDay || state.endTime != null) return state;
    return { ...state, endTime: laterTime(state.startTime, DEFAULT_TIMED_QUARTERS) };
}

/**
 * The create and update session dialogs' form: the picker's state in place of `startsAt`/`endsAt`,
 * which `sessionInstants` derives on submit.
 */
export const sessionDialogSchema = SkillCheckSession.modifiableSchema
    .pick({ name: true, notes: true })
    .extend({ when: sessionWhenSchema });

/**
 * A session dialog's values as `createSession`/`updateSession` take them: `sessionInstants`
 * checked against `SkillCheckSession.inputSchema`, so a refusal shows on the "When" field rather
 * than as the server's BAD_REQUEST. `sessionWhenSchema` already rules out the rest, so what's left
 * is a start inside a spring-forward gap (02:15 on NZ's last Sunday of September): it moves
 * forward by the gap, onto or past an end that was after it on the clock.
 */
export function parseSessionDialog(
    { when, ...fields }: z.infer<typeof sessionDialogSchema>,
    orgZone: string,
): { success: true; data: ModifiableSkillCheckSession } | { success: false; message: string } {
    const instants = sessionInstants(when, orgZone);
    const parsed = SkillCheckSession.inputSchema.safeParse({ ...fields, ...instants });
    if (parsed.success) return { success: true, data: parsed.data };

    const startMoved =
        !when.allDay && format(new TZDate(instants.startsAt, orgZone), "HH:mm") !== when.startTime;
    return {
        success: false,
        message: startMoved
            ? "The clocks go forward at that start time, so the session would start later than shown, at or after its end. Pick a later end time or a different start."
            : (parsed.error.issues[0]?.message ?? "Those times can't be saved"),
    };
}

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
 * When a skill check session runs, all in the org's zone: "All day" and "Multiple days" switches
 * over a grid of tiles in the style of Facebook's event form. Tiles: a start date, an end date
 * with "Multiple days", and with "All day" off a start time and an end time (optional on one day,
 * required over several). Controlled over `SessionFormState`; `sessionInstants` turns the value
 * into what's stored.
 *
 * The switches and tiles follow from the value alone, so an edit dialog opens on the right ones.
 * A timed session puts the dates in the first column and the times in the second.
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

    const hasEndDate = value.days > 1;

    const timeLabel = (time: string) => format(parse(time, "HH:mm", new Date()), timePattern);

    // On one day, the end options run from just after the start round to just before it, so the
    // list reads in order; those that wrap past midnight end the next day. Over several days the
    // end is on the end date, at any time.
    const endOptions = useMemo(() => {
        if (hasEndDate) return QUARTER_HOURS.map((time) => ({ time, nextDay: false }));
        const startIndex = QUARTER_HOURS.indexOf(value.startTime);
        return QUARTER_HOURS.slice(startIndex + 1)
            .map((time) => ({ time, nextDay: false }))
            .concat(QUARTER_HOURS.slice(0, startIndex).map((time) => ({ time, nextDay: true })));
    }, [value.startTime, hasEndDate]);

    const zoneHint = useMemo(() => {
        // Only the start matters here, so ask for a one-day timed one with no end. It renders on
        // every keystroke, so a half-formed value falls back to the bare zone rather than throwing.
        try {
            const { startsAt } = sessionInstants(
                { ...value, allDay: false, days: 1, endTime: null },
                orgZone,
            );
            return `Times in ${orgZone} (${zoneAbbreviation(new Date(startsAt), orgZone)})`;
        } catch {
            return `Times in ${orgZone}`;
        }
    }, [value, orgZone]);

    const allDayId = useId();
    const multiDayId = useId();

    // Picking the start day as the end date removes the End date tile, so the focus moves to the
    // start date once it's gone, rather than falling back to the dialog. The switches keep their
    // own focus.
    const startDateRef = useRef<HTMLButtonElement>(null);
    const focusNext = useRef<RefObject<HTMLButtonElement | null> | null>(null);

    const timed = !value.allDay;
    useEffect(() => {
        focusNext.current?.current?.focus();
        focusNext.current = null;
    }, [hasEndDate]);

    function update(patch: Partial<SessionFormState>, focus?: RefObject<HTMLButtonElement | null>) {
        if (focus) focusNext.current = focus;
        onChange({ ...value, ...patch });
    }

    /** Back to one day. A one-day end can't equal the start time, so such an end moves 2h later. */
    function toOneDay(focus?: RefObject<HTMLButtonElement | null>) {
        update(
            {
                days: 1,
                endTime:
                    value.endTime === value.startTime
                        ? laterTime(value.startTime, DEFAULT_TIMED_QUARTERS)
                        : value.endTime,
            },
            focus,
        );
    }

    function calendarOpenChange(which: "start" | "end") {
        return (open: boolean) => setOpenCalendar(open ? which : null);
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                    <Switch
                        id={allDayId}
                        checked={value.allDay}
                        onCheckedChange={(allDay) =>
                            update(
                                allDay
                                    ? { allDay: true }
                                    : {
                                          allDay: false,
                                          endTime: laterTime(
                                              value.startTime,
                                              DEFAULT_TIMED_QUARTERS,
                                          ),
                                      },
                            )
                        }
                    />
                    <Label htmlFor={allDayId}>All day</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        id={multiDayId}
                        checked={hasEndDate}
                        onCheckedChange={(multiDay) =>
                            multiDay ? update({ days: 2 }) : toOneDay()
                        }
                    />
                    <Label htmlFor={multiDayId}>Multiple days</Label>
                </div>
            </div>

            {/* Two equal columns: each tile takes exactly half the width, in its fixed cell. */}
            <div className="grid grid-cols-2 gap-2">
                <div className={TILE_CELL.startDate}>
                    <Popover
                        open={openCalendar === "start"}
                        onOpenChange={calendarOpenChange("start")}
                    >
                        {/* No aria-label: the visible label and date name the button, so the date is announced. */}
                        <PopoverTrigger
                            ref={startDateRef}
                            aria-invalid={invalid}
                            className={TILE_CLASS}
                        >
                            <TileBody
                                icon={CalendarIcon}
                                label={hasEndDate ? "Start date" : "Date"}
                            >
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
                </div>

                {timed && (
                    <div className={TILE_CELL.startTime}>
                        <Select
                            value={value.startTime}
                            onValueChange={(startTime) => {
                                // Radix fires "" when it mounts or resets inside a form; that isn't a choice.
                                if (!startTime) return;
                                // Over several days the end has its own date and time, so it stays.
                                if (hasEndDate) {
                                    update({ startTime });
                                    return;
                                }
                                // On one day, keep the session's length: the end moves with the
                                // start, as in a calendar app. The length is 1–95 quarters (an end
                                // never equals its start), so the moved end can't land on the new
                                // start either.
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
                    </div>
                )}

                {hasEndDate && (
                    <div className={TILE_CELL.endDate}>
                        <Popover
                            open={openCalendar === "end"}
                            onOpenChange={calendarOpenChange("end")}
                        >
                            <PopoverTrigger aria-invalid={invalid} className={TILE_CLASS}>
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
                                        { after: addDays(day, MAX_SESSION_DAYS - 1) },
                                    ]}
                                    onSelect={(selected) => {
                                        // Picking the start day itself makes it a one-day session
                                        // again, removing this tile, as turning off "Multiple
                                        // days" does.
                                        const days = differenceInCalendarDays(selected, day) + 1;
                                        if (days === 1) toOneDay(startDateRef);
                                        else update({ days });
                                        setOpenCalendar(null);
                                    }}
                                    autoFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                )}

                {timed && (
                    <div className={TILE_CELL.endTime}>
                        <Select
                            value={value.endTime ?? undefined}
                            onValueChange={(endTime) => {
                                if (!endTime) return; // Radix's mount/reset "", as for the start time
                                update({ endTime });
                            }}
                        >
                            <SelectTrigger
                                aria-label="End time"
                                aria-invalid={invalid}
                                className={SELECT_TILE_CLASS}
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
                    </div>
                )}
            </div>

            <p className="text-muted-foreground text-xs">{zoneHint}</p>
        </div>
    );
}
