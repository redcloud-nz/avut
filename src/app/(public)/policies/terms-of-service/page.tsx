/*
 *  Copyright (c) 2025 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /policies/terms-of-service
 */

import { Argus } from "@/components/blocks/argus";

export const metadata = { title: "Terms of Service" };

export default function TermsOfService_Page() {
    return (
        <Argus.Root>
            <Argus.Column width="md">
                <Argus.AppLogo />
                <main className="mt-8">
                    <h1 className="text-3xl md:text-4xl font-bold mb-6">Terms of Service</h1>
                    <p className="text-lg mb-4">Last updated: January 1, 2025</p>
                    <p className="mb-4">
                        Welcome to AVUT! By using our services, you agree to comply with and be
                        bound by the following terms and conditions. Please read them carefully.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">1. Acceptance of Terms</h2>
                    <p className="mb-4">
                        By accessing or using our services, you agree to be bound by these Terms of
                        Service and our Privacy Policy. If you do not agree with any part of these
                        terms, you must not use our services.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">2. Changes to Terms</h2>
                    <p className="mb-4">
                        We may update these terms from time to time. We will notify you of any
                        changes by posting the new terms on this page. Your continued use of the
                        service after any changes constitutes your acceptance of the new terms.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">3. User Responsibilities</h2>
                    <p className="mb-4">
                        You are responsible for maintaining the confidentiality of your account
                        information and for all activities that occur under your account. You agree
                        to notify us immediately of any unauthorized use of your account.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">4. Prohibited Activities</h2>
                    <p className="mb-4">
                        You agree not to engage in any activity that is unlawful, harmful, or
                        disruptive to our services or other users. This includes, but is not limited
                        to, spamming, hacking, or distributing malware.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">5. Termination</h2>
                    <p className="mb-4">
                        We reserve the right to suspend or terminate your access to our services at
                        any time, without notice, for conduct that we believe violates these terms
                        or is harmful to other users, us, or third parties, or for any other reason.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">6. Limitation of Liability</h2>
                    <p className="mb-4">
                        To the fullest extent permitted by law, we shall not be liable for any
                        indirect, incidental, special, consequential, or punitive damages arising
                        out of or related to your use of our services, even if we have been advised
                        of the possibility of such damages. Our total liability to you for all
                        claims arising out of or relating to these terms or your use of our services
                        shall not exceed the amount you paid us, if any, in the twelve months
                        preceding the claim.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">7. Governing Law</h2>
                    <p className="mb-4">
                        These terms shall be governed by and construed in accordance with the laws
                        of New Zealand.
                    </p>
                    <h2 className="text-2xl font-semibold mt-6 mb-4">8. Contact Us</h2>
                    <p className="mb-4">
                        If you have any questions about these Terms of Service, please contact us at
                        <a href="mailto:support@avut.nz" className="text-blue-500 hover:underline">
                            support@avut.nz
                        </a>
                        .
                    </p>
                </main>
            </Argus.Column>
        </Argus.Root>
    );
}
