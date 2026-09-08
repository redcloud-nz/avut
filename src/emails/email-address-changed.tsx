/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    Body,
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

interface EmailAddressChangedTemplateProps {
    name: string;
    previousEmail: string;
    newEmail: string;
}

export default function EmailAddressChangedTemplate({
    name = "John Smith",
    previousEmail = "john.smith@example.com",
    newEmail = "john.smith@newexample.com",
}: EmailAddressChangedTemplateProps) {
    return (
        <Html lang="en">
            <Tailwind config={{ presets: [pixelBasedPreset] }}>
                <Body className="mx-auto my-auto bg-white px-2 font-sans">
                    <Preview>The email address on your AVUT account was changed</Preview>
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
                            Your email address was changed
                        </Heading>
                        <Text className="text-[14px] text-black leading-6">
                            Hello {name}. The email address associated with your AVUT account was
                            just changed from {previousEmail} to {newEmail}.
                        </Text>
                        <Text className="text-[14px] text-black leading-6">
                            All future sign-ins and notifications will use the new address.
                        </Text>
                        <Text className="text-[14px] text-black leading-6">
                            If you didn&apos;t make this change, contact your organization
                            administrator immediately.
                        </Text>
                        <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
                        <Text className="text-[#666666] text-[12px] leading-6">
                            This email was sent to {previousEmail} because it was the previous
                            address on the account.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
