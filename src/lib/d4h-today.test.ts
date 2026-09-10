/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { buildD4HToday, zonedTodayRange } from "./d4h-today";

function activity(
    over: Partial<Parameters<typeof buildD4HToday>[0][number]["activities"][number]> = {},
) {
    return {
        id: 1,
        resourceType: "Event" as const,
        reference: "E-001",
        referenceDescription: "Tuesday Night Training",
        startsAt: "2026-09-07T07:00:00Z",
        endsAt: "2026-09-07T09:00:00Z",
        location: "Station 1",
        ...over,
    };
}

function attendance(
    over: Partial<Parameters<typeof buildD4HToday>[0][number]["attendances"][number]> = {},
) {
    return {
        activity: { id: 1, resourceType: "Event" as const },
        status: "ATTENDING" as const,
        ...over,
    };
}

const TEAM = { id: 10, title: "Christchurch CDEM" };

describe("zonedTodayRange", () => {
    it("returns the UTC instants bounding the civil day in the given timezone", () => {
        // 2026-09-07T02:00Z is still 2026-09-06 in Auckland? No — NZST/NZDT is UTC+12/13,
        // so 02:00Z on the 7th is 14:00 on the 7th locally. The day is the 7th.
        const now = new Date("2026-09-07T02:00:00Z");

        const { start, end } = zonedTodayRange(now, "Pacific/Auckland");

        // NZ is on standard time (UTC+12) in early September 2026 (DST starts late Sept).
        expect(start.toISOString()).toBe("2026-09-06T12:00:00.000Z");
        expect(end.toISOString()).toBe("2026-09-07T12:00:00.000Z");
    });

    it("uses the local calendar date, not the UTC one", () => {
        // 23:30 on the 7th in New York is 03:30Z on the 8th — the local day is still the 7th.
        const now = new Date("2026-09-08T03:30:00Z");

        const { start, end } = zonedTodayRange(now, "America/New_York");

        // EDT is UTC-4 in September.
        expect(start.toISOString()).toBe("2026-09-07T04:00:00.000Z");
        expect(end.toISOString()).toBe("2026-09-08T04:00:00.000Z");
    });
});

describe("buildD4HToday", () => {
    it("joins each event/exercise to its attendance status", () => {
        const [group] = buildD4HToday([
            {
                team: TEAM,
                timezone: "Pacific/Auckland",
                activities: [
                    activity({ id: 1, resourceType: "Event" }),
                    activity({
                        id: 2,
                        resourceType: "Exercise",
                        referenceDescription: "Rope Rescue",
                    }),
                ],
                attendances: [
                    attendance({ activity: { id: 1, resourceType: "Event" }, status: "ATTENDING" }),
                    attendance({ activity: { id: 2, resourceType: "Exercise" }, status: "ABSENT" }),
                ],
            },
        ]);

        expect(group.activities.map((a) => [a.id, a.status])).toEqual([
            [1, "attending"],
            [2, "absent"],
        ]);
    });

    it("marks an event with no attendance record as not-involved", () => {
        const [group] = buildD4HToday([
            {
                team: TEAM,
                timezone: "Pacific/Auckland",
                activities: [activity({ id: 3 })],
                attendances: [],
            },
        ]);

        expect(group.activities[0].status).toBe("not-involved");
    });

    it("maps REQUESTED to requested", () => {
        const [group] = buildD4HToday([
            {
                team: TEAM,
                timezone: "Pacific/Auckland",
                activities: [activity({ id: 1 })],
                attendances: [attendance({ status: "REQUESTED" })],
            },
        ]);

        expect(group.activities[0].status).toBe("requested");
    });

    it("includes an incident only when it has an attendance record", () => {
        const [group] = buildD4HToday([
            {
                team: TEAM,
                timezone: "Pacific/Auckland",
                activities: [
                    activity({
                        id: 4,
                        resourceType: "Incident",
                        referenceDescription: "Callout A",
                    }),
                    activity({
                        id: 5,
                        resourceType: "Incident",
                        referenceDescription: "Callout B",
                    }),
                ],
                attendances: [
                    attendance({ activity: { id: 4, resourceType: "Incident" }, status: "ABSENT" }),
                ],
            },
        ]);

        expect(group.activities.map((a) => a.id)).toEqual([4]);
    });

    it("does not confuse an event and an incident that share an id", () => {
        const [group] = buildD4HToday([
            {
                team: TEAM,
                timezone: "Pacific/Auckland",
                activities: [activity({ id: 7, resourceType: "Event" })],
                attendances: [
                    attendance({
                        activity: { id: 7, resourceType: "Incident" },
                        status: "ATTENDING",
                    }),
                ],
            },
        ]);

        expect(group.activities[0].status).toBe("not-involved");
    });

    it("titles an activity by description, then reference, then a fallback", () => {
        const [group] = buildD4HToday([
            {
                team: TEAM,
                timezone: "Pacific/Auckland",
                activities: [
                    activity({ id: 1, referenceDescription: "Named", reference: "R1" }),
                    activity({ id: 2, referenceDescription: null, reference: "R2" }),
                    activity({ id: 3, referenceDescription: null, reference: null }),
                ],
                attendances: [],
            },
        ]);

        expect(group.activities.map((a) => a.title)).toEqual(["Named", "R2", "Untitled activity"]);
    });

    it("sorts activities within a team by start time", () => {
        const [group] = buildD4HToday([
            {
                team: TEAM,
                timezone: "Pacific/Auckland",
                activities: [
                    activity({ id: 1, startsAt: "2026-09-07T20:00:00Z" }),
                    activity({ id: 2, startsAt: "2026-09-07T08:00:00Z" }),
                ],
                attendances: [],
            },
        ]);

        expect(group.activities.map((a) => a.id)).toEqual([2, 1]);
    });

    it("returns teams sorted by title, each carrying its own activities and timezone", () => {
        const groups = buildD4HToday([
            {
                team: { id: 2, title: "Zulu" },
                timezone: "America/New_York",
                activities: [activity({ id: 1 })],
                attendances: [],
            },
            {
                team: { id: 1, title: "Alpha" },
                timezone: "Pacific/Auckland",
                activities: [activity({ id: 2 })],
                attendances: [],
            },
        ]);

        expect(groups.map((g) => g.team.title)).toEqual(["Alpha", "Zulu"]);
        expect(groups.map((g) => g.timezone)).toEqual(["Pacific/Auckland", "America/New_York"]);
    });
});
