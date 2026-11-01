/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { render } from "@react-email/components";

import D4HAttendanceReminderEmail, {
    d4hAttendanceReminderSubject,
    type D4HAttendanceReminderEmailProps,
} from "./d4h-attendance-reminder";

const props: D4HAttendanceReminderEmailProps = {
    organization: { name: "Acme SAR" },
    team: { name: "Alpha Team" },
    // 19:00 on Monday 2 November in Auckland (NZDT, UTC+13).
    exercise: { title: "Night navigation", startsAt: new Date("2026-11-02T06:00:00Z") },
    timeZone: "Pacific/Auckland",
    message: "Meet at the hall.",
    recipientEmail: "member@example.com",
    optOutUrl: "https://www.avut.nz/public/d4h-nag/opt-out/TOKEN123",
};

describe("d4hAttendanceReminderSubject", () => {
    it("names the exercise and its start in the org's time zone", () => {
        expect(d4hAttendanceReminderSubject(props.exercise, props.timeZone)).toBe(
            "Are you coming to Night navigation? Mon 2 Nov, 7:00 pm",
        );
    });
});

describe("D4HAttendanceReminderEmail", () => {
    it("renders the org, team, exercise, message and opt-out link", async () => {
        const text = await render(<D4HAttendanceReminderEmail {...props} />, { plainText: true });

        expect(text).toContain("Acme SAR");
        expect(text).toContain("Alpha Team");
        expect(text).toContain("Night navigation");
        expect(text).toContain("Mon 2 Nov, 7:00 pm");
        expect(text).toContain("Meet at the hall.");
        expect(text).toContain("update your attendance in D4H");
        expect(text).toContain("member@example.com");

        const html = await render(<D4HAttendanceReminderEmail {...props} />);
        expect(html).toContain('href="https://www.avut.nz/public/d4h-nag/opt-out/TOKEN123"');
    });

    it("links to the exercise in D4H only when given its URL", async () => {
        const without = await render(<D4HAttendanceReminderEmail {...props} />);
        expect(without).not.toContain("Open in D4H");

        const d4hExerciseUrl = "https://acme.team-manager.ap.d4h.com/team/exercises/view/42";
        const withLink = await render(
            <D4HAttendanceReminderEmail {...props} d4hExerciseUrl={d4hExerciseUrl} />,
        );
        expect(withLink).toContain("Open in D4H");
        expect(withLink).toContain(`href="${d4hExerciseUrl}"`);
    });

    it("leaves out the message when it's empty", async () => {
        const text = await render(<D4HAttendanceReminderEmail {...props} message="" />, {
            plainText: true,
        });
        expect(text).not.toContain("Meet at the hall.");
    });
});
