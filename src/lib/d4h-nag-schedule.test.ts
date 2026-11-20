/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    describeSchedule,
    isSlotDue,
    latestSlot,
    manualWindow,
    scheduledWindow,
} from "./d4h-nag-schedule";

const NZ = "Pacific/Auckland";
const HOUR = 60 * 60_000;

const at = (iso: string) => new Date(iso);

describe("latestSlot", () => {
    const monday12 = { weekday: 1, hour: 12 };

    it("returns a slot earlier the same day", () => {
        // Mon 2 Nov 2026 15:30 NZDT
        expect(latestSlot(monday12, NZ, at("2026-11-02T02:30:00Z"))).toEqual(
            at("2026-11-01T23:00:00Z"),
        );
    });

    it("returns last week's slot when today's hour hasn't come yet", () => {
        // Mon 2 Nov 2026 09:00 NZDT → Mon 26 Oct 12:00 NZDT
        expect(latestSlot(monday12, NZ, at("2026-11-01T20:00:00Z"))).toEqual(
            at("2026-10-25T23:00:00Z"),
        );
    });

    it("returns the most recent earlier weekday", () => {
        // Mon 2 Nov 2026 09:00 NZDT, rule Fridays 18:00 → Fri 30 Oct 18:00 NZDT
        expect(latestSlot({ weekday: 5, hour: 18 }, NZ, at("2026-11-01T20:00:00Z"))).toEqual(
            at("2026-10-30T05:00:00Z"),
        );
    });

    it("returns now when now is exactly on the slot", () => {
        const now = at("2026-11-01T23:00:00Z");
        expect(latestSlot(monday12, NZ, now)).toEqual(now);
    });

    it("stays on the wall-clock hour when last week's slot was before a DST change", () => {
        // Mon 28 Sep 2026 11:00 NZDT (DST started Sun 27 Sep) → Mon 21 Sep 12:00 NZST, 167h earlier
        expect(latestSlot(monday12, NZ, at("2026-09-27T22:00:00Z"))).toEqual(
            at("2026-09-21T00:00:00Z"),
        );
    });

    describe("on the day DST starts (Sun 27 Sep 2026, 02:00 → 03:00)", () => {
        const now = at("2026-09-26T21:00:00Z"); // 10:00 NZDT

        it("maps the hour that doesn't exist to the instant the clocks jump", () => {
            expect(latestSlot({ weekday: 0, hour: 2 }, NZ, now)).toEqual(
                at("2026-09-26T14:00:00Z"),
            );
        });

        it("which is the same slot as 03:00", () => {
            expect(latestSlot({ weekday: 0, hour: 3 }, NZ, now)).toEqual(
                at("2026-09-26T14:00:00Z"),
            );
        });
    });

    describe("on the day DST ends (Sun 5 Apr 2026, 03:00 → 02:00)", () => {
        const sunday02 = { weekday: 0, hour: 2 };

        it("maps the hour that happens twice to its first occurrence", () => {
            // 05:00 NZST
            expect(latestSlot(sunday02, NZ, at("2026-04-04T17:00:00Z"))).toEqual(
                at("2026-04-04T13:00:00Z"),
            );
        });

        it("doesn't make the repeated hour a second slot", () => {
            // 02:30 NZST, during the repeat
            expect(latestSlot(sunday02, NZ, at("2026-04-04T14:30:00Z"))).toEqual(
                at("2026-04-04T13:00:00Z"),
            );
        });

        it("returns last week's slot just before the first occurrence", () => {
            // 01:59 NZDT → Sun 29 Mar 02:00 NZDT
            expect(latestSlot(sunday02, NZ, at("2026-04-04T12:59:00Z"))).toEqual(
                at("2026-03-28T13:00:00Z"),
            );
        });
    });
});

describe("isSlotDue", () => {
    const slot = at("2026-11-01T23:00:00Z");

    it("is due when the rule has never been claimed", () => {
        expect(isSlotDue(null, slot)).toBe(true);
    });

    it("is due when the last claim was for an earlier slot", () => {
        expect(isSlotDue(at("2026-10-25T23:00:00Z"), slot)).toBe(true);
    });

    it("isn't due when the slot is already claimed", () => {
        expect(isSlotDue(slot, slot)).toBe(false);
    });

    it("isn't due when a later slot is claimed", () => {
        expect(isSlotDue(at("2026-11-08T23:00:00Z"), slot)).toBe(false);
    });
});

describe("scheduledWindow", () => {
    const slot = at("2026-11-01T23:00:00Z");

    it("runs from slot + 1h to slot + lookAheadHours when on time", () => {
        expect(scheduledWindow(slot, 24, slot)).toEqual({
            start: new Date(slot.getTime() + HOUR),
            end: new Date(slot.getTime() + 24 * HOUR),
        });
    });

    it("is clipped to now + 1h when the run is late", () => {
        const now = new Date(slot.getTime() + 5 * HOUR);
        expect(scheduledWindow(slot, 24, now)).toEqual({
            start: new Date(now.getTime() + HOUR),
            end: new Date(slot.getTime() + 24 * HOUR),
        });
    });

    it("is empty when the run is too late for any of the look-ahead", () => {
        expect(scheduledWindow(slot, 24, new Date(slot.getTime() + 23 * HOUR))).toBeNull();
        expect(scheduledWindow(slot, 24, new Date(slot.getTime() + 30 * HOUR))).toBeNull();
    });

    it("is empty for a one-hour look-ahead", () => {
        expect(scheduledWindow(slot, 1, slot)).toBeNull();
    });
});

describe("manualWindow", () => {
    const now = at("2026-11-02T02:17:00Z");

    it("runs from now + 1h to now + lookAheadHours", () => {
        expect(manualWindow(48, now)).toEqual({
            start: new Date(now.getTime() + HOUR),
            end: new Date(now.getTime() + 48 * HOUR),
        });
    });

    it("is empty for a one-hour look-ahead", () => {
        expect(manualWindow(1, now)).toBeNull();
    });
});

describe("describeSchedule", () => {
    it("names the weekday and the hour", () => {
        expect(describeSchedule({ weekday: 1, hour: 12 })).toBe("Mondays at 12:00");
        expect(describeSchedule({ weekday: 0, hour: 7 })).toBe("Sundays at 07:00");
    });
});
