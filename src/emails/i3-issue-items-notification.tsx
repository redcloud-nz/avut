/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    pixelBasedPreset,
    Preview,
    Row,
    Section,
    Tailwind,
    Text,
} from "@react-email/components";

import { I3IssueItemsFormData } from "@/forms/i3-issue-items/schema";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { I3TemplateVariantId } from "@/lib/schemas/i3-template-variant";

const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

interface I3IssueItemsNotificationEmailProps {
    issuer: {
        name: string;
    };
    emailTarget: {
        email: string;
    };
    formData: I3IssueItemsFormData;
    savedToD4H: true | { reason: string };
}

export default function I3IssueItemsNotificationEmail({
    issuer = { name: "Alex Westphal" },
    emailTarget = {
        email: "your-email@example.com",
    },
    savedToD4H = { reason: "insufficient permissions" },
    formData = {
        recipient: {
            id: 42,
            teamId: 7,
            name: "John Smith",
        },
        comments: "",
        items: [
            {
                template: {
                    id: I3TemplateId.create(),
                    name: "Standard Helmet",
                },
                variant: {
                    id: I3TemplateVariantId.create(),
                    name: "Petzl Vertex Vent",
                },
                serialNumber: "SN123456",
            },
            {
                template: {
                    id: I3TemplateId.create(),
                    name: "RT Boots",
                },
                variant: {
                    id: I3TemplateVariantId.create(),
                    name: "Blundstone 991 Size 08",
                },
                serialNumber: null,
            },
        ],
    },
}: I3IssueItemsNotificationEmailProps) {
    return (
        <Html lang="en">
            <Tailwind config={{ presets: [pixelBasedPreset] }}>
                <Head />
                <Body className="mx-auto my-auto bg-white px-2 font-sans">
                    <Preview>Items Issued to {formData.recipient.name}</Preview>
                    <Container className="mx-auto my-10 max-w-[465px] rounded border border-[#eaeaea] border-solid p-5">
                        <Section className="mt-8">
                            <Img
                                src={`${baseUrl}/avut-logo.png`}
                                width="150"
                                height="50"
                                alt="AVUT Logo"
                                className="mx-auto my-0"
                            />
                        </Section>
                        <Heading className="max-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
                            Items Issued to {formData.recipient.name}
                        </Heading>

                        <Section>
                            <Text className="text-[14px] text-black leading-6">
                                {issuer.name} has issued the following items to{" "}
                                {formData.recipient.name}:
                            </Text>
                            {formData.items.map((item, index) => (
                                <Row key={index}>
                                    <Text className="text-[14px] leading-4 ml-2 mt-2 mb-1">
                                        {item.template.name}
                                    </Text>
                                    <Text className="text-[14px] leading-4 text-gray-500 ml-2 mt-1 mb-2">
                                        {[
                                            item.variant?.name,
                                            item.serialNumber ? `S/N: ${item.serialNumber}` : null,
                                        ]
                                            .filter(Boolean)
                                            .join(" - ")}
                                    </Text>
                                </Row>
                            ))}
                        </Section>

                        {formData.comments && (
                            <Section>
                                <Heading as="h4" className="font-medium text-sm">
                                    Comments
                                </Heading>
                                <Text>{formData.comments}</Text>
                            </Section>
                        )}

                        <Section>
                            <Text className="text-[14px] text-black leading-6">
                                {savedToD4H === true
                                    ? "This issuance has been recorded in D4H."
                                    : `This issuance has not been recorded in D4H due to ${savedToD4H.reason}.`}
                            </Text>
                        </Section>

                        <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />

                        <Text className="text-[#666666] text-[12px] leading-6">
                            This email was sent to {emailTarget.email}. If you did not request this,
                            please ignore it.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
