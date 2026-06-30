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

interface OneTimePasswordTemplateProps {
    email: string;
    otp: string;
    type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}

export default function OneTimePasswordTemplate({
    email = "john.smith@example.com",
    otp = "123456",
    type = "email-verification",
}: OneTimePasswordTemplateProps) {
    return (
        <Html lang="end">
            <Tailwind config={{ presets: [pixelBasedPreset] }}>
                <Body className="mx-auto my-auto bg-white px-2 font-sans">
                    <Preview>Account Verification Code</Preview>
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
                        <Heading className="max-0 mt-[30px] p-0 text-center font-normal text-[24px] text-black">
                            {type == "email-verification" && "Your email verification code"}
                            {type == "sign-in" && "Your sign-in code"}
                            {type == "forget-password" && "Your password reset code"}
                            {type == "change-email" && "Your email change code"}
                        </Heading>
                        <Text className="my-8 text-center font-semibold text-[32px] text-black tracking-widest">
                            {otp}
                        </Text>
                        <Text className="text-[14px] text-black leading-6">
                            This code is valid for 5 minutes. Please do not share with anyone.
                        </Text>

                        <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
                        <Text className="text-[#666666] text-[12px] leading-6">
                            This email was sent to {email}. If you did not request this, please
                            ignore it.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
