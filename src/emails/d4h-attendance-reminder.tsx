/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { format } from "date-fns";

import { TZDate } from "@date-fns/tz";
import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    pixelBasedPreset,
    Preview,
    Section,
    Tailwind,
    Text,
} from "@react-email/components";

import { assetBaseUrl } from "./base-url";

export interface D4HAttendanceReminderEmailProps {
    organization: { name: string };
    team: { name: string };
    exercise: { title: string; startsAt: Date };
    /** The org's time zone, which the exercise start is shown in. */
    timeZone: string;
    /** The rule's message. Empty means none. */
    message: string;
    /** The member's email address, for the footer. */
    recipientEmail: string;
    /** `${baseUrl}/public/d4h-nag/opt-out/<token>`. */
    optOutUrl: string;
    /** The exercise in the D4H web app, when its URL can be built. */
    d4hExerciseUrl?: string | null;
}

const SAMPLE_PROPS = {
    organization: { name: "Test Organization" },
    team: { name: "Response Team" },
    exercise: {
        title: "Rope rescue training",
        startsAt: new Date("2026-11-03T06:00:00Z"),
    },
    timeZone: "Pacific/Auckland",
    message: "Bring your harness. We'll be at the quarry if the weather holds.",
    recipientEmail: "jan.kowalski@example.com",
    optOutUrl: "http://localhost:3000/public/d4h-nag/opt-out/SAMPLETOKEN",
    d4hExerciseUrl: null,
} satisfies D4HAttendanceReminderEmailProps;

/** The exercise start in the org's time zone, e.g. "Tue 3 Nov, 7:00 pm". */
export function formatExerciseStart(startsAt: Date, timeZone: string): string {
    return format(new TZDate(startsAt, timeZone), "EEE d MMM, h:mm aaa");
}

/** The reminder's subject line, e.g. "Are you coming to Rope rescue training? Tue 3 Nov, 7:00 pm". */
export function d4hAttendanceReminderSubject(
    exercise: { title: string; startsAt: Date },
    timeZone: string,
): string {
    return `Are you coming to ${exercise.title}? ${formatExerciseStart(exercise.startsAt, timeZone)}`;
}

/**
 * Email reminding a D4H member who hasn't answered an exercise invitation to update their
 * attendance in D4H. Sent from `NoReplyEmailAddress` with the org's Reply-To.
 */
export default function D4HAttendanceReminderEmail({
    organization = SAMPLE_PROPS.organization,
    team = SAMPLE_PROPS.team,
    exercise = SAMPLE_PROPS.exercise,
    timeZone = SAMPLE_PROPS.timeZone,
    message = SAMPLE_PROPS.message,
    recipientEmail = SAMPLE_PROPS.recipientEmail,
    optOutUrl = SAMPLE_PROPS.optOutUrl,
    d4hExerciseUrl = SAMPLE_PROPS.d4hExerciseUrl,
}: D4HAttendanceReminderEmailProps) {
    const startsAt = formatExerciseStart(exercise.startsAt, timeZone);

    return (
        <Html lang="en">
            <Tailwind config={{ presets: [pixelBasedPreset] }}>
                <Head />
                <Body className="mx-auto my-auto bg-white px-2 font-sans">
                    <Preview>Are you coming to {exercise.title}?</Preview>
                    <Container className="mx-auto my-10 max-w-[465px] rounded border border-[#eaeaea] border-solid p-5">
                        <Section className="mt-8">
                            <Img
                                src={`${assetBaseUrl}/avut-logo.png`}
                                width="150"
                                height="50"
                                alt="AVUT Logo"
                                className="mx-auto my-0"
                            />
                        </Section>
                        <Heading className="max-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
                            Are you coming to {exercise.title}?
                        </Heading>

                        <Section>
                            <Text className="my-1 text-[14px] text-black leading-6">
                                <span className="text-gray-500">Exercise:</span> {exercise.title}
                            </Text>
                            <Text className="my-1 text-[14px] text-black leading-6">
                                <span className="text-gray-500">Starts:</span> {startsAt}
                            </Text>
                            <Text className="my-1 text-[14px] text-black leading-6">
                                <span className="text-gray-500">Team:</span> {team.name} (
                                {organization.name})
                            </Text>
                        </Section>

                        {message && (
                            <Section>
                                <Text className="whitespace-pre-line text-[14px] text-black leading-6">
                                    {message}
                                </Text>
                            </Section>
                        )}

                        <Text className="text-[14px] text-black leading-6">
                            You haven&apos;t told D4H yet whether you&apos;re attending. Please
                            update your attendance in D4H so the organisers know who to expect.
                        </Text>

                        {d4hExerciseUrl && (
                            <Section className="mt-8 mb-8 text-center">
                                <Button
                                    className="rounded bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
                                    href={d4hExerciseUrl}
                                >
                                    Open in D4H
                                </Button>
                            </Section>
                        )}

                        <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
                        <Text className="text-[#666666] text-[12px] leading-6">
                            This email was sent to {recipientEmail} because you were invited to this
                            exercise in D4H as a member of {team.name}. To stop receiving these
                            reminders,{" "}
                            <Link href={optOutUrl} className="text-blue-600 no-underline">
                                opt out
                            </Link>
                            .
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
