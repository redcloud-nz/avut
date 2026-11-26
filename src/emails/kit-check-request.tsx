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
    Link,
    pixelBasedPreset,
    Preview,
    Section,
    Tailwind,
    Text,
} from "@react-email/components";

import { PoweredByAvut } from "./powered-by-avut";

export interface KitCheckRequestEmailProps {
    organization: { name: string };
    /** The D4H member the form is for. */
    member: { name: string };
    /** The D4H team they're asked as a member of. */
    team: { name: string };
    bundle: { name: string };
    /** Who sent the kit check: the sender's name, or a role when they're unknown. */
    requestedBy: string;
    /** `${baseUrl}/forms/kit-check/<token>`. */
    formUrl: string;
    /** When the link stops working. */
    expiresAt: Date;
    /** The org's time zone, which the expiry is shown in. */
    timeZone: string;
    /** The member's email address, for the footer. */
    recipientEmail: string;
}

const SAMPLE_PROPS = {
    organization: { name: "Test Organization" },
    member: { name: "Jan Kowalski" },
    team: { name: "Response Team" },
    bundle: { name: "Field Responder" },
    requestedBy: "Alex Smith",
    formUrl: "http://localhost:3000/forms/kit-check/SAMPLETOKEN",
    expiresAt: new Date("2026-12-09T06:00:00Z"),
    timeZone: "Pacific/Auckland",
    recipientEmail: "jan.kowalski@example.com",
} satisfies KitCheckRequestEmailProps;

/** The link's expiry in the org's time zone, e.g. "Wed 9 Dec 2026". */
export function formatKitCheckExpiry(expiresAt: Date, timeZone: string): string {
    return format(new TZDate(expiresAt, timeZone), "EEE d MMM yyyy");
}

/** The kit-check email's subject line, e.g. "Kit check: Field Responder". */
export function kitCheckRequestSubject(bundle: { name: string }): string {
    return `Kit check: ${bundle.name}`;
}

/**
 * Email asking a D4H member to check the kit of an I3 bundle they hold and need, through a link to
 * their own form. Sent from `NoReplyEmailAddress` with the org's Reply-To.
 */
export default function KitCheckRequestEmail({
    organization = SAMPLE_PROPS.organization,
    member = SAMPLE_PROPS.member,
    team = SAMPLE_PROPS.team,
    bundle = SAMPLE_PROPS.bundle,
    requestedBy = SAMPLE_PROPS.requestedBy,
    formUrl = SAMPLE_PROPS.formUrl,
    expiresAt = SAMPLE_PROPS.expiresAt,
    timeZone = SAMPLE_PROPS.timeZone,
    recipientEmail = SAMPLE_PROPS.recipientEmail,
}: KitCheckRequestEmailProps) {
    const expires = formatKitCheckExpiry(expiresAt, timeZone);

    return (
        <Html lang="en">
            <Tailwind config={{ presets: [pixelBasedPreset] }}>
                <Head />
                <Body className="mx-auto my-auto bg-white px-2 font-sans">
                    <Preview>Please check your {bundle.name} kit</Preview>
                    <Container className="mx-auto my-10 max-w-[465px] rounded border border-[#eaeaea] border-solid p-5">
                        <Heading className="mx-0 mt-8 mb-[30px] p-0 text-center font-normal text-[24px] text-black">
                            Kit check: {bundle.name}
                        </Heading>

                        <Text className="text-[14px] text-black leading-6">Hi {member.name},</Text>
                        <Text className="text-[14px] text-black leading-6">
                            {requestedBy} has asked you to check your {bundle.name} kit as a member
                            of {team.name} ({organization.name}). The form lists the items D4H shows
                            you holding. Tell us whether you still have each one, and what
                            you&apos;re missing or need replaced.
                        </Text>

                        <Section className="mt-8 mb-8 text-center">
                            <Button
                                className="rounded bg-[#553423] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
                                href={formUrl}
                            >
                                Open my kit check
                            </Button>
                        </Section>

                        <Text className="text-[14px] text-black leading-6">
                            Your answers save as you go, so you can come back to it. The link works
                            until {expires}.
                        </Text>
                        <Text className="text-[14px] text-black leading-6">
                            If the button doesn&apos;t work, copy this link into your browser:{" "}
                            <Link href={formUrl} className="text-blue-600 no-underline">
                                {formUrl}
                            </Link>
                        </Text>

                        <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
                        <Text className="text-[#666666] text-[12px] leading-6">
                            This email was sent to {recipientEmail} because you&apos;re a member of{" "}
                            {team.name} in D4H. The link is yours alone: please don&apos;t forward
                            it.
                        </Text>
                        <PoweredByAvut />
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
