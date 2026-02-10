/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { AuthOrganization } from "@/server/auth";
import {
    Body,
    Button,
    Container,
    Heading,
    Hr,
    Html,
    Img,
    pixelBasedPreset,
    Preview,
    Section,
    Tailwind,
    Text,
} from "@react-email/components";

const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

interface OrganizationInviteTemplateProps {
    invitation: { id: string; email: string };
    organization: AuthOrganization;
    inviter: { user: { name: string; email: string } };
}

const SAMPLE_PROPS = {
    invitation: {
        id: "TESTINVITEID",
        email: "jan.kowalski@example.com",
    },

    inviter: {
        user: { name: "Alice Johnson", email: "alice.johnson@example.com" },
    },
    organization: {
        id: "TESTORG",
        name: "Test Organization",
        slug: "test-organization",
        createdAt: new Date(),
    },
} satisfies OrganizationInviteTemplateProps;

/**
 * Email template for an organization invitation.
 */
export default function OrganizationInviteTemplate({
    invitation = SAMPLE_PROPS.invitation,
    organization = SAMPLE_PROPS.organization,
    inviter = SAMPLE_PROPS.inviter,
}: OrganizationInviteTemplateProps) {
    const acceptUrl = `${baseUrl}/auth/accept-invitation/${invitation.id}`;

    return (
        <Html lang="en">
            <Tailwind config={{ presets: [pixelBasedPreset] }}>
                <Body className="mx-auto my-auto bg-white px-2 font-sans">
                    <Preview>
                        You're invited to join {organization.name} on AVUT
                    </Preview>
                    <Container className="mx-auto my-10 max-w-[465px] rounded border border-[#eaeaea] border-solid p-5">
                        <Section className="mt-8">
                            <Img
                                src={`${baseUrl}/avut-logo.svg`}
                                width="150"
                                height="50"
                                alt="AVUT Logo"
                                className="mx-auto my-0"
                            />
                        </Section>
                        <Heading className="max-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
                            Your invitation to join {organization.name}
                        </Heading>
                        <Text className="text-[14px] text-black leading-6">
                            {`Hello. You have been invited by ${inviter.user.name} (${inviter.user.email}) to join "${organization.name}" on AVUT.`}
                        </Text>
                        <Section className="mt-8 mb-8 text-center">
                            <Button
                                className="rounded bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
                                href={acceptUrl}
                            >
                                View Invitation
                            </Button>
                        </Section>
                        <Text className="text-[14px] text-black leading-6">
                            or copy and paste the following link into your
                            browser:{" "}
                            <a
                                href={acceptUrl}
                                className="text-blue-600 no-underline"
                            >
                                {acceptUrl}
                            </a>
                        </Text>
                        <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
                        <Text className="text-[#666666] text-[12px] leading-6">
                            This email was sent to {invitation.email}. If you
                            did not expect this invitation, please ignore this
                            email.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
