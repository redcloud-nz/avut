/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    pixelBasedPreset,
    Preview,
    Tailwind,
    Text,
} from "@react-email/components";

interface HelloEmailProps {
    firstName: string;
}

export default function HelloEmail({
    firstName = "John Smith",
}: HelloEmailProps) {
    return (
        <Html lang="en">
            <Head />
            <Tailwind config={{ presets: [pixelBasedPreset] }}>
                <Body className="mx-auto my-auto bg-white px-2 font-sans">
                    <Preview>Hello, {firstName}!</Preview>
                    <Container className="mx-auto my-10 max-w-[465px] rounded border border-[#eaeaea] border-solid p-5">
                        <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
                            Hello, {firstName}!
                        </Heading>
                        <Text className="text-[14px] text-black leading-6">
                            Welcome to our service. We're glad to have you on
                            board.
                        </Text>
                        <p></p>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
