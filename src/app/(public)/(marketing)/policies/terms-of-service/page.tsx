/*
 *  Copyright (c) 2025 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /policies/terms-of-service
 */

import Link from "next/link";

import { Argus } from "@/components/blocks/argus";

export const metadata = { title: "Terms of Service" };

export default function TermsOfService_Page() {
    return (
        <Argus.Root fullHeight={false}>
            <Argus.Column width="md" className="max-w-3xl">
                <main className="mt-8">
                    <h1 className="text-3xl md:text-4xl font-bold mb-6">Terms of Service</h1>
                    <p className="text-lg mb-4">Last updated: 14 September 2026</p>
                    <p className="mb-4">
                        These terms govern your use of AVUT. Please read them, particularly section
                        5 if you are setting up an organisation, because it places obligations on
                        you in respect of other people&rsquo;s information.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        1. Who you are dealing with
                    </h2>
                    <p className="mb-4">
                        AVUT is operated by Alex Westphal, Christchurch, New Zealand
                        (&ldquo;we&rdquo;, &ldquo;us&rdquo;). You can reach us at{" "}
                        <a href="mailto:support@avut.nz" className="text-blue-500 hover:underline">
                            support@avut.nz
                        </a>
                        .
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">2. What AVUT is</h2>
                    <p className="mb-4">
                        AVUT is a web application providing organisational management tools,
                        including personnel and team records, equipment issue and inspection, skill
                        tracking and assessment, notes, and optional read-only views of data from a
                        connected D4H account. Which tools an organisation sees depends on what it
                        has enabled.
                    </p>
                    <p className="mb-4">
                        <strong>
                            AVUT is pre-release software, provided free of charge and under active
                            development.
                        </strong>{" "}
                        We do not promise any particular level of availability, we may change or
                        remove features, and some features are explicitly experimental. It is not a
                        system of record for anything you cannot afford to lose, and you should keep
                        your own copies of information that matters to you.
                    </p>
                    <p className="mb-4">
                        Being pre-release has a consequence worth stating plainly: some of what
                        these terms and our{" "}
                        <Link href="/policies/privacy" className="text-blue-500 hover:underline">
                            Privacy Policy
                        </Link>{" "}
                        commit us to is not built yet. Closing an account, exporting an
                        organisation&rsquo;s data and deleting an organisation are all done by hand
                        today, by the person named in section 1, in response to an email. We will
                        honour those commitments at the scale we currently operate at, and we would
                        rather tell you they are manual than imply a self-service button that does
                        not exist. Where a section below promises something that is handled this
                        way, it says so.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">3. Accepting these terms</h2>
                    <p className="mb-4">
                        By creating an account or using AVUT, you agree to these terms and to our{" "}
                        <Link href="/policies/privacy" className="text-blue-500 hover:underline">
                            Privacy Policy
                        </Link>
                        . If you do not agree, please do not use AVUT. If you are agreeing on behalf
                        of an organisation, you confirm you are authorised to bind it.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">4. Your account</h2>
                    <p className="mb-4">
                        Keep your login credentials confidential, and tell us promptly at the
                        address above if you believe someone else has gained access to your account.
                        You are responsible for what happens under your account, except to the
                        extent it results from our own failure.
                    </p>
                    <p className="mb-4">
                        You may sign in with an email address and password, or with a GitHub or
                        Google account. If you use one of those, your relationship with that
                        provider is governed by its terms, not ours, and losing access to it may
                        mean losing the ability to sign in to AVUT. What we receive from them is set
                        out in our{" "}
                        <Link href="/policies/privacy" className="text-blue-500 hover:underline">
                            Privacy Policy
                        </Link>
                        .
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        5. Your organisation&rsquo;s data, and your privacy obligations
                    </h2>
                    <p className="mb-4">
                        When your organisation enters information about its people into AVUT, your
                        organisation remains the agency responsible for that information under the{" "}
                        <span className="italic">Privacy Act 2020</span>. We hold it solely on your
                        behalf, which section 11 of that Act treats as the information being held by
                        you rather than by us.
                    </p>
                    <p className="mb-4">By using AVUT for that purpose, you agree that:</p>
                    <ul className="mb-4 list-disc pl-6 space-y-1">
                        <li>
                            you have a lawful basis to collect and hold the information you put into
                            AVUT;
                        </li>
                        <li>
                            you have told the people concerned what you collect, why, who holds it
                            and who else may see it, and of their rights of access and correction,
                            as IPP 3 requires;
                        </li>
                        <li>
                            you will handle access and correction requests from your own people,
                            including any request to attach a statement of correction under IPP
                            7(3);
                        </li>
                        <li>
                            you will keep the information accurate and will remove what you no
                            longer need; and
                        </li>
                        <li>
                            you will not enter health information or other sensitive categories —
                            see section 6.
                        </li>
                    </ul>
                    <p className="mb-4">
                        We will assist you in responding to a request or a privacy incident so far
                        as we reasonably can, and will tell you without undue delay if we become
                        aware of a breach affecting information we hold for you.
                    </p>
                    <p className="mb-4">
                        <strong>Your data remains yours.</strong> You grant us only the permission
                        needed to host, process, back up and display it in order to provide AVUT to
                        you. We do not use it for any other purpose, and we do not sell it.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">6. Acceptable use</h2>
                    <p className="mb-4">You must not use AVUT to:</p>
                    <ul className="mb-4 list-disc pl-6 space-y-1">
                        <li>
                            <strong>record health information about an identifiable person</strong>{" "}
                            — including medical conditions, injuries, treatment, or fitness-for-duty
                            assessments — or information about criminal history. AVUT is not built
                            to handle information governed by the{" "}
                            <span className="italic">Health Information Privacy Code 2020</span>,
                            and free-text fields such as notes, tags and custom properties are not
                            an exception;
                        </li>
                        <li>do anything unlawful, or infringe anyone else&rsquo;s rights;</li>
                        <li>
                            attempt to gain access to data belonging to an organisation you are not
                            a member of, or to circumvent permission checks;
                        </li>
                        <li>
                            interfere with the service, including by distributing malware, sending
                            unsolicited bulk email, or placing unreasonable load on it; or
                        </li>
                        <li>
                            upload someone else&rsquo;s personal information without a lawful basis
                            for doing so.
                        </li>
                    </ul>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        7. D4H and other third parties
                    </h2>
                    <p className="mb-4">
                        D4H is a separate platform operated by someone else. If you connect a D4H
                        account you do so under your own agreement with D4H, and you are responsible
                        for the access token you supply and for having the right to use it. We are
                        not responsible for D4H&rsquo;s availability, accuracy, or handling of your
                        data, and D4H integration may stop working if D4H changes its service.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        8. Suspension and termination
                    </h2>
                    <p className="mb-4">
                        You may stop using AVUT at any time. To have your account closed and your
                        account information deleted, email us at the address in section 1 and we
                        will action it — AVUT does not yet have a self-service way to do this.
                    </p>
                    <p className="mb-4">
                        We may terminate your access by giving you 30 days&rsquo; notice by email.
                        We may suspend access immediately, without prior notice, only where it is
                        reasonably necessary to protect the service or other users — for example a
                        security compromise, unlawful use, or conduct breaching section 6. If we
                        suspend you we will tell you why as soon as we reasonably can, and will
                        restore access once the cause is resolved.
                    </p>
                    <p className="mb-4">
                        <strong>Getting your data out.</strong> For 30 days after termination you
                        may ask us for a copy of your organisation&rsquo;s data and we will provide
                        it in a machine-readable format at no charge. After that period we delete
                        it, as described in our Privacy Policy. There is no export button yet: ask
                        at the address in section 1 and we will extract it for you by hand. We will
                        not delete an organisation&rsquo;s data while a request for a copy of it is
                        outstanding.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">9. Intellectual property</h2>
                    <p className="mb-4">
                        The AVUT source code is published under the MIT Licence, and that licence
                        governs what you may do with the code. It does not grant any right to the
                        hosted service at avut.nz, which is governed by these terms, nor any right
                        to data held in it.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        10. Your rights under New Zealand consumer law
                    </h2>
                    <p className="mb-4">
                        Nothing in these terms limits or excludes any right or remedy you have under
                        the <span className="italic">Consumer Guarantees Act 1993</span>, the{" "}
                        <span className="italic">Fair Trading Act 1986</span>, or any other law that
                        cannot lawfully be excluded. If you are a consumer under the Consumer
                        Guarantees Act, the guarantees in that Act apply to AVUT and are not
                        affected by section 11 below.
                    </p>
                    <p className="mb-4">
                        If you acquire AVUT for business purposes and you are in trade, the Consumer
                        Guarantees Act does not apply, and the limitation in section 11 applies in
                        full.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        11. Limitation of liability
                    </h2>
                    <p className="mb-4">
                        Subject to section 10, and to the extent the law permits, we are not liable
                        for indirect or consequential loss, for loss of profits or goodwill, or for
                        loss or corruption of data, arising from your use of AVUT. Our total
                        liability for all claims relating to AVUT is limited to NZ$100.
                    </p>
                    <p className="mb-4">
                        That figure reflects the fact that AVUT is supplied free of charge. It does
                        not apply where the law does not allow liability to be limited, including
                        for our fraud, and it does not cut down the consumer guarantees described in
                        section 10.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">12. Changes to these terms</h2>
                    <p className="mb-4">
                        We may update these terms. If a change materially affects your rights or
                        obligations, we will email account holders at least 14 days before it takes
                        effect, and the change will apply from the date stated in that notice. If
                        you do not accept a change, you may close your account before it takes
                        effect and ask for a copy of your data under section 8. Other changes, such
                        as correcting an error, take effect when published.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">13. Governing law</h2>
                    <p className="mb-4">
                        These terms are governed by New Zealand law, and the New Zealand courts have
                        exclusive jurisdiction over any dispute arising from them. Nothing in this
                        section deprives you of the protection of New Zealand consumer law.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">14. General</h2>
                    <p className="mb-4">
                        If any part of these terms is unenforceable, the rest continues to apply. If
                        we do not enforce a right straight away, we do not lose it. You may not
                        transfer your rights under these terms without our agreement; we may
                        transfer ours if AVUT changes hands, and we will tell you if that happens.
                        Notices to you go to the email address on your account, and notices to us go
                        to the address in section 1.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">15. Contact us</h2>
                    <p className="mb-4">
                        If you have any questions about these Terms of Service, please contact us at{" "}
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
