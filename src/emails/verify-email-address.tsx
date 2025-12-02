/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { User } from "better-auth";
import {
    Body,
    Button,
    Container,
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

const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

interface VerifyEmailAddressTemplateProps {
    verificationUrl: string;
    user: User;
}

export default function VerifyEmailAddressTemplate({
    verificationUrl = "http://localhost:3000/verify-email?token=TESTTOKEN",
    user = {
        id: "TESTUSER",
        name: "John Smith",
        email: "john.smith@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
    },
}: VerifyEmailAddressTemplateProps) {
    return (
        <Html lang="end">
            <Tailwind config={{ presets: [pixelBasedPreset] }}>
                <Body className="mx-auto my-auto bg-white px-2 font-sans">
                    <Preview>Verify your email address</Preview>
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
                            Email verification
                        </Heading>
                        <Text className="text-[14px] text-black leading-6">
                            Please verify your email address by clicking the
                            button below:
                        </Text>
                        <Section className="mt-8 mb-8 text-center">
                            <Button
                                className="rounded bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
                                href={verificationUrl}
                            >
                                Verify
                            </Button>
                        </Section>
                        <Text className="text-[14px] text-black leading-6">
                            or copy and paste this URL into your browser:{" "}
                            <Link
                                href={verificationUrl}
                                className="text-blue-600 no-underline"
                            >
                                {verificationUrl}
                            </Link>
                        </Text>
                        <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
                        <Text className="text-[#666666] text-[12px] leading-6">
                            This email was sent to {user.email}. If you did not
                            request this, please ignore it.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
