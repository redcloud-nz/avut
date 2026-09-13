/*
 *  Copyright (c) 2025 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /policies/privacy
 */

import Link from "next/link";

import { Argus } from "@/components/blocks/argus";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicy_Page() {
    return (
        <Argus.Root fullHeight={false}>
            <Argus.Column width="md" className="max-w-3xl">
                <main className="mt-8">
                    <h1 className="text-3xl md:text-4xl font-bold mb-6">Privacy Policy</h1>
                    <p className="text-lg mb-4">Last updated: 14 September 2026</p>
                    <p className="mb-4">
                        This policy explains how personal information is handled in AVUT. It is
                        written to meet the information privacy principles (IPPs) in the{" "}
                        <span className="italic">Privacy Act 2020</span>.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">1. Who we are</h2>
                    <p className="mb-4">
                        AVUT is operated by Alex Westphal, Christchurch, New Zealand. For anything
                        in this policy, including access and correction requests and privacy
                        complaints, contact{" "}
                        <a
                            href="mailto:alexwestphal@avut.nz"
                            className="text-blue-500 hover:underline"
                        >
                            alexwestphal@avut.nz
                        </a>
                        . Alex Westphal is also the privacy officer for the purposes of section 201
                        of the <span className="italic">Privacy Act 2020</span>.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        2. Two different roles — please read this first
                    </h2>
                    <p className="mb-4">
                        AVUT handles two kinds of personal information, and our responsibilities
                        differ between them.
                    </p>
                    <p className="mb-4">
                        <strong>Your account.</strong> If you sign up for AVUT, we are the agency
                        that collects and holds your account information, and this policy governs
                        it.
                    </p>
                    <p className="mb-4">
                        <strong>Your organisation&rsquo;s records.</strong> Most of the personal
                        information in AVUT — personnel, team memberships, skill checks, issued
                        equipment, notes — is entered by an organisation about its own people. We
                        hold that information solely on that organisation&rsquo;s behalf. Under
                        section 11 of the <span className="italic">Privacy Act 2020</span> it is
                        treated as held by the organisation, not by us. The organisation is
                        responsible for telling its people what it collects and why, and for
                        answering their access and correction requests.
                    </p>
                    <p className="mb-4">
                        If you are a member of an organisation that uses AVUT and you want to see or
                        correct what is recorded about you, contact that organisation. If you
                        contact us instead, we will pass the request on and assist the organisation
                        in responding, but we cannot change an organisation&rsquo;s records on our
                        own initiative.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        3. What information we collect
                    </h2>
                    <p className="mb-4">
                        <strong>Account information</strong> — your name, email address, and an
                        optional profile image, collected when you register or are invited. We also
                        hold authentication records and active session details so you can stay
                        signed in.
                    </p>
                    <p className="mb-4">
                        <strong>Organisation records</strong> — information an organisation enters
                        or uploads about its personnel. This is usually names, email addresses,
                        team memberships, skill and assessment results, and equipment issued. We do
                        not collect this from the individuals concerned; it comes from the
                        organisation. This is permitted by IPP 2(2), which allows collection from
                        another source where collecting directly would not be reasonably
                        practicable for the purpose.
                    </p>
                    <p className="mb-4">
                        <strong>D4H data</strong> — if an organisation connects a D4H account, we
                        retrieve personnel and team information from the D4H platform using an
                        access token that organisation supplies. D4H integration is entirely
                        optional and off unless an organisation turns it on.
                    </p>
                    <p className="mb-4">
                        <strong>Activity records</strong> — AVUT keeps an audit log of actions taken
                        on records, recording who did what and when. This exists so organisations
                        can see the history of their own data.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        4. How we use your information
                    </h2>
                    <p className="mb-4">
                        We use personal information to operate AVUT, to authenticate you, to send
                        service emails such as invitations and password resets, to maintain the
                        audit log, and to diagnose faults. We do not sell personal information, and
                        we do not use it for advertising or profiling.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">5. Who we share it with</h2>
                    <p className="mb-4">
                        We use the following providers to run the service. Each holds or processes
                        information on our behalf, under section 11 of the{" "}
                        <span className="italic">Privacy Act 2020</span>, and is not permitted to
                        use it for its own purposes.
                    </p>
                    <ul className="mb-4 list-disc pl-6 space-y-1">
                        <li>
                            <strong>Vercel</strong> — application hosting and file storage.
                        </li>
                        <li>
                            <strong>Neon</strong> — the PostgreSQL database.
                        </li>
                        <li>
                            <strong>Resend</strong> — sending service email.
                        </li>
                        <li>
                            <strong>D4H</strong> — only where an organisation has connected its own
                            D4H account. Information exchanged with D4H is governed by that
                            organisation&rsquo;s own arrangement with D4H.
                        </li>
                    </ul>
                    <p className="mb-4">
                        We may also disclose information where the law requires it, or where it is
                        necessary to prevent or lessen a serious threat to someone&rsquo;s life or
                        health.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">6. Where your data is held</h2>
                    <p className="mb-4">
                        AVUT&rsquo;s application and database run on Amazon Web Services
                        infrastructure in the Sydney region (ap-southeast-2), in Australia. Service
                        email is sent through Resend, which may process message content outside
                        Australia and New Zealand.
                    </p>
                    <p className="mb-4">
                        Because these providers hold information on our behalf rather than for their
                        own purposes, this is not a cross-border disclosure under IPP 12. We remain
                        responsible under IPP 5 for the safeguards protecting it, and we have
                        satisfied ourselves those safeguards are appropriate.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">7. How we protect it</h2>
                    <p className="mb-4">
                        Access to organisation data requires an authenticated account with a role
                        granting the relevant permission, enforced on the server rather than only in
                        the interface. Data is encrypted in transit. D4H access tokens are encrypted
                        at rest using AES-256-GCM with a unique initialisation vector and an
                        authentication tag for each value. Actions on records are written to an
                        audit log attributing them to the account that performed them.
                    </p>
                    <p className="mb-4">
                        No system is perfectly secure, and we do not claim otherwise. AVUT is
                        actively developed software offered free of charge, and you should weigh
                        that when deciding what to put in it.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        8. Administrator access to your data
                    </h2>
                    <p className="mb-4">
                        System administrators can sign in as another user in order to diagnose
                        faults and provide support. While doing so they can see what that user
                        sees, including that organisation&rsquo;s records. Every such session is
                        recorded in the audit log, identifying both the administrator and the
                        account being accessed. We use this only where it is necessary to operate or
                        support the service.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        9. Health and other sensitive information
                    </h2>
                    <p className="mb-4">
                        <strong>AVUT must not be used to record health information.</strong> This
                        includes medical conditions, injuries, treatment, fitness-for-duty
                        assessments, and any similar information about an identifiable person. It
                        must also not be used for information about criminal history or any other
                        category attracting heightened protection. AVUT is not built to handle
                        information governed by the{" "}
                        <span className="italic">Health Information Privacy Code 2020</span>, and
                        free-text fields such as notes, tags, and custom properties are not an
                        exception to this.
                    </p>
                    <p className="mb-4">
                        Organisations are responsible for ensuring their people do not enter such
                        information. If you believe health information has been entered, contact us
                        and we will work with the organisation to remove it.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">10. How long we keep it</h2>
                    <p className="mb-4">
                        We do not keep personal information for longer than is required for the
                        purposes for which it may lawfully be used.
                    </p>
                    <p className="mb-4">
                        <strong>Organisation records</strong> are deleted within 30 days after an
                        organisation stops using AVUT, unless that organisation asks us to delete
                        them sooner. During those 30 days the organisation may request a copy of its
                        data.
                    </p>
                    <p className="mb-4">
                        <strong>Account information</strong> is deleted when you close your account.
                    </p>
                    <p className="mb-4">
                        <strong>Audit log entries are retained after the account or record they
                        describe has been deleted.</strong>{" "}
                        An audit log that disappears along with its subject cannot serve its
                        purpose, which is to let an organisation establish what happened to its
                        records. When an account is deleted, entries describing that
                        account&rsquo;s actions are de-identified: the link to the account is
                        removed and only a stored display label remains.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">11. Your rights</h2>
                    <p className="mb-4">
                        Under IPP 6 and IPP 7 of the{" "}
                        <span className="italic">Privacy Act 2020</span> you have the right to ask
                        for confirmation of whether we hold personal information about you, to
                        access it, and to ask us to correct it if it is wrong.
                    </p>
                    <p className="mb-4">
                        If we decline to correct information, you may ask us to attach a statement
                        of the correction you sought. We will take reasonable steps to ensure that
                        statement accompanies the information whenever it is later used or
                        disclosed.
                    </p>
                    <p className="mb-4">
                        We will respond to a request as soon as reasonably practicable, and no later
                        than 20 working days after receiving it, as the Act requires. There is no
                        charge.
                    </p>
                    <p className="mb-4">
                        For information held on an organisation&rsquo;s behalf, direct your request
                        to that organisation — see section 2. New Zealand law does not give a
                        general right to erasure or a general right to object to processing, and we
                        would rather say so plainly than imply rights you do not have. Deletion of
                        organisation records is a matter for the organisation that entered them.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">12. Privacy breaches</h2>
                    <p className="mb-4">
                        If a privacy breach occurs that it is reasonable to believe has caused, or
                        is likely to cause, serious harm, we will notify the Office of the Privacy
                        Commissioner and the affected people as soon as practicable, as Part 6 of
                        the <span className="italic">Privacy Act 2020</span> requires. Where the
                        information affected is held on an organisation&rsquo;s behalf, we will
                        notify that organisation without undue delay so it can meet its own
                        obligations.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">13. Cookies</h2>
                    <p className="mb-4">
                        AVUT sets cookies that are strictly necessary to keep you signed in and to
                        remember interface preferences such as your theme. We do not use advertising
                        or third-party tracking cookies, which is why you are not asked to consent
                        to any.
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">14. Complaints</h2>
                    <p className="mb-4">
                        If you think we have mishandled your personal information, please contact us
                        first so we can try to put it right. If you are not satisfied, you may
                        complain to the Office of the Privacy Commissioner at{" "}
                        <a
                            href="https://www.privacy.org.nz"
                            className="text-blue-500 hover:underline"
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            privacy.org.nz
                        </a>
                        .
                    </p>

                    <h2 className="text-2xl font-semibold mt-6 mb-4">
                        15. Changes to this policy
                    </h2>
                    <p className="mb-4">
                        We may update this policy. If a change materially affects how we handle your
                        personal information, we will tell account holders by email before it takes
                        effect. The date at the top shows when this version was published.
                    </p>

                    <p className="mb-4">
                        See also our{" "}
                        <Link
                            href="/policies/terms-of-service"
                            className="text-blue-500 hover:underline"
                        >
                            Terms of Service
                        </Link>
                        .
                    </p>
                </main>
            </Argus.Column>
        </Argus.Root>
    );
}
