/*
 *  Copyright (c) 2025 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /policies/privacy
 */

import { Argus } from "@/components/blocks/argus";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicy_Page() {
    return (
        <Argus.Root>
            <Argus.Column width="md">
                <Argus.AppLogo />
                <main className="mt-8">
                    <h1 className="text-3xl md:text-4xl font-bold mb-6">Privacy Policy</h1>
                    <p className="text-lg mb-4">Last updated: 12 April, 2025</p>
                    <p className="mb-4">
                        We are committed to protecting your privacy. This Privacy Policy outlines
                        how we collect, use, and safeguard your information when you use our
                        services.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">Information We Collect</h2>
                    <p className="mb-4">
                        We may collect personal information such as your name, email address, and
                        other contact details when you register for an account or interact with our
                        services.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        How We Use Your Information
                    </h2>
                    <p className="mb-4">
                        We use your information to provide and improve our services, communicate
                        with you, and comply with legal obligations.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">Data Security</h2>
                    <p className="mb-4">
                        We implement appropriate technical and organizational measures to protect
                        your personal information from unauthorized access, loss, or misuse.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">Your Rights</h2>
                    <p className="mb-4">
                        You have the right to access, correct, or delete your personal information.
                        You can also object to the processing of your data in certain circumstances.
                    </p>
                </main>
            </Argus.Column>
        </Argus.Root>
    );
}
