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

import { I3ReturnedItem, I3ReturnItemsFormData } from "@/forms/i3-return-items/schema";

import { assetBaseUrl } from "./base-url";

interface I3ReturnItemsNotificationEmailProps {
    /** The AVUT user who submitted the Return ("Received by"). */
    receiver: {
        name: string;
    };
    emailTarget: {
        email: string;
    };
    formData: I3ReturnItemsFormData;
    /** The items with a retire task queued, labelled as D4H has them. */
    returnedItems: I3ReturnedItem[];
    /** One line per item that couldn't be returned, naming the item and why. */
    failures: string[];
}

export default function I3ReturnItemsNotificationEmail({
    receiver = { name: "Alex Westphal" },
    emailTarget = {
        email: "your-email@example.com",
    },
    formData = {
        recipient: {
            id: 42,
            teamId: 7,
            name: "John Smith",
        },
        comments: "Helmet strap is frayed.",
        items: [
            { itemId: 1001, ref: "1234", kindTitle: "Helmet" },
            { itemId: 1002, ref: "1235", kindTitle: "RT Boots" },
        ],
    },
    returnedItems = [{ itemId: 1001, ref: "1234", kindTitle: "Helmet" }],
    failures = ["#1235 RT Boots: already has an open retire task"],
}: I3ReturnItemsNotificationEmailProps) {
    return (
        <Html lang="en">
            <Tailwind config={{ presets: [pixelBasedPreset] }}>
                <Head />
                <Body className="mx-auto my-auto bg-white px-2 font-sans">
                    <Preview>Items Returned by {formData.recipient.name}</Preview>
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
                            Items Returned by {formData.recipient.name}
                        </Heading>

                        {returnedItems.length > 0 && (
                            <Section>
                                <Text className="text-[14px] text-black leading-6">
                                    {receiver.name} has received the following items from{" "}
                                    {formData.recipient.name}:
                                </Text>
                                {returnedItems.map((item) => (
                                    <Row key={item.itemId}>
                                        <Text className="text-[14px] leading-4 ml-2 mt-2 mb-2">
                                            #{item.ref} {item.kindTitle}
                                        </Text>
                                    </Row>
                                ))}
                                <Text className="text-[14px] text-black leading-6">
                                    Each of these items has a retire task waiting to be applied in
                                    D4H.
                                </Text>
                            </Section>
                        )}

                        {failures.length > 0 && (
                            <Section>
                                <Text className="text-[14px] text-black leading-6">
                                    {returnedItems.length > 0
                                        ? "These items could not be returned:"
                                        : `None of the items ${receiver.name} tried to receive from ${formData.recipient.name} could be returned:`}
                                </Text>
                                {failures.map((failure, index) => (
                                    <Row key={index}>
                                        <Text className="text-[14px] leading-4 text-gray-500 ml-2 mt-1 mb-2">
                                            {failure}
                                        </Text>
                                    </Row>
                                ))}
                            </Section>
                        )}

                        {formData.comments && (
                            <Section>
                                <Heading as="h4" className="font-medium text-sm">
                                    Comments
                                </Heading>
                                <Text>{formData.comments}</Text>
                            </Section>
                        )}

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
