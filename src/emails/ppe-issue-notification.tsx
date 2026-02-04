/*
 *  Copyright (c) 2025 A.V.U.T. Project.
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
    Section,
    Tailwind,
    Text,
} from "@react-email/components";

import { type PPEIssueFormData } from "@/lib/schemas/ppe";

const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

interface PPEIssueNotificationEmailProps {
    formData: PPEIssueFormData;
}

export default function PPEIssueNotificationEmail({
    formData = {
        issuer: {
            id: "user-alexwestphal",
            name: "Alex Westphal",
        },
        recipient: {
            id: "user-johnsmith",
            name: "John Smith",
        },
        comments: "",
        issuedItems: [
            {
                id: "01",
                templateId: "ww-jacket",
                itemName: "Jacket (Wet Weather)",
                size: "XL",
                serialNumber: "",
            },
            {
                id: "02",
                templateId: "ww-pants",
                itemName: "Pants (Wet Weather)",
                size: "XL",
                serialNumber: "",
            },
            {
                id: "03",
                templateId: "gloves",
                itemName: "Gloves",
                size: "L",
                serialNumber: "",
            },
        ],
        email: "alexwestphal.nz@gmail.com",
    },
}: PPEIssueNotificationEmailProps) {
    return (
        <Html lang="en">
            <Tailwind config={{ presets: [pixelBasedPreset] }}>
                <Head />
                <Body className="mx-auto my-auto bg-white px-2 font-sans">
                    <Preview>PPE Issued to {formData.recipient.name}</Preview>
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
                            PPE Issued to {formData.recipient.name}
                        </Heading>
                        <Text className="text-[14px] text-black leading-6">
                            {formData.issuer.name} has reported issuing the
                            following PPE items to {formData.recipient.name}:
                        </Text>

                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b hover:bg-muted/50 transition-colors">
                                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">
                                        Item
                                    </th>
                                    <th className="text-foreground h-10 px-2 text-center align-middle font-medium whitespace-nowrap">
                                        Size
                                    </th>
                                    <th className="text-foreground h-10 px-2 text-center align-middle font-medium whitespace-nowrap">
                                        Serial Number
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.issuedItems.map((item, index) => (
                                    <tr
                                        key={index}
                                        className="border-b border-b-black hover:bg-muted/50 transition-colors"
                                    >
                                        <td className="p-2 align-middle whitespace-nowrap">
                                            {item.itemName}
                                        </td>
                                        <td className="p-2 align-middle whitespace-nowrap text-center">
                                            {item.size}
                                        </td>
                                        <td className="p-2 align-middle whitespace-nowrap text-center">
                                            {item.serialNumber}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {formData.comments && (
                            <Section>
                                <Heading
                                    as="h4"
                                    className="font-medium text-sm"
                                >
                                    Comments
                                </Heading>
                                <Text>{formData.comments}</Text>
                            </Section>
                        )}
                        {/* <Section className="mt-4">
                            <Link
                                className="text-[12px] leading-6"
                                href={
                                    Paths.pub("christchurch-em").forms.ppe.issue
                                        .href
                                }
                            >
                                View this form submission online
                            </Link>
                        </Section> */}

                        <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />

                        <Text className="text-[#666666] text-[12px] leading-6">
                            This email was sent to {formData.email}. If you did
                            not request this, please ignore it.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
