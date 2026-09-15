/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /
 */

import { Suspense, type ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";
import { Cable, Tag } from "lucide-react";

import { OssBanner } from "@/components/marketing/oss-banner";
import { ProductShot } from "@/components/marketing/product-shot";
import { Button } from "@/components/ui/button";
import { VersionString } from "@/components/ui/version-string";
import { orgModules } from "@/lib/modules";
import { hasActiveSession } from "@/server/session";

/**
 * Marketing copy per module. Names and icons come from the `Modules` registry.
 * `(typeof orgModules)[number]["id"]` is `OrganizationModuleId`, not narrowed to
 * the ids `orgModules` actually filters down to, so `forms` (vestigial, has no
 * `href` and never appears in `orgModules`) still needs an entry here to satisfy it.
 */
const MODULE_COPY = {
    admin: "Users, teams, personnel and invitations for your organisation.",
    "d4h-views": "Read-only views of the D4H data you already maintain.",
    forms: "",
    i3: "Issue, inspect and return equipment and PPE, with templates per item type. Runs on your D4H equipment records.",
    notes: "Rich-text notes that live with the org instead of in someone's inbox.",
    "skill-track": "Skill checks, assessment sessions, a catalogue and reports on who's current.",
    "skill-package-builder":
        "Author the skill packages your assessors work from, and version them.",
} satisfies Record<(typeof orgModules)[number]["id"], string>;

/** Module ids that only work with a connected D4H account. */
const NEEDS_D4H = new Set(["d4h-views", "i3"]);

/**
 * Hero product screenshot — the "Assess by Person" recording view from the
 * seeded demo org (`prisma/seed-demo.ts`). Managed via `npm run screenshot`;
 * see `docs/specs/docs-screenshots.md`.
 */
const PRODUCT_SHOT_ID = "marketing/skill-track-session";

const FAQ: { q: string; a: ReactNode }[] = [
    {
        q: "Is this a real product?",
        a: "It's a real, working application and a genuine side project. It's used, it's maintained, and it isn't a company.",
    },
    {
        q: "Can anyone sign up?",
        a: "You can create an account, but the tools only make sense inside an organisation — either you create one, or someone in your team invites you.",
    },
    {
        q: "Do I need D4H?",
        a: "For D4H Views and I3, yes — both read your D4H data, so they need a connected D4H account. Admin, Skill Track, Notes and the Skill Package Builder don't.",
    },
    {
        q: "Where does our data live?",
        a: (
            <>
                In a Postgres database in Sydney (AWS ap-southeast-2), scoped per organisation. The{" "}
                <Link href="/policies/privacy" className="underline underline-offset-4">
                    privacy policy
                </Link>{" "}
                spells out what&apos;s collected and why.
            </>
        ),
    },
];

function SignedOutHeroCta() {
    return (
        <>
            <Button asChild size="lg">
                <Link href="/auth/sign-up">Sign Up</Link>
            </Button>
            <span className="text-sm text-muted-foreground">
                Already in a team? Your invite link brings you straight in.
            </span>
        </>
    );
}

/**
 * Owns its own `<Suspense>` boundary so this is the *only* dynamic part of the page; see
 * #96 for why that doesn't yet buy a cached static shell for the rest of it. `hasActiveSession()`
 * shares the header's own `cache()`-wrapped lookup for the same request.
 */
async function HeroCta() {
    if (!(await hasActiveSession())) return <SignedOutHeroCta />;
    return (
        <>
            <Button asChild size="lg">
                <Link href="/orgs/--select-org">Open AVUT</Link>
            </Button>
            <span className="text-sm text-muted-foreground">You&apos;re signed in.</span>
        </>
    );
}

export default function HomePage() {
    return (
        <>
            <div id="top" className="scroll-mt-20 border-b border-border bg-muted/40">
                <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-10 px-6 py-12 md:grid-cols-[1.15fr_0.85fr] md:px-10 md:py-16">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                            <VersionString
                                showName={false}
                                className="inline-flex h-[22px] items-center rounded-full border border-border bg-background px-2"
                            />
                            <span>MIT licensed · free to use</span>
                        </div>
                        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-pretty md:text-5xl">
                            Tools for tracking and managing things.
                        </h1>
                        <p className="max-w-[46ch] text-lg leading-relaxed text-muted-foreground text-pretty">
                            Skills, people, equipment, clothing. AVUT — Assorted Vaguely Useful
                            Tools — is a small set of org-scoped tools for volunteer and
                            emergency-response teams. It&apos;s a side project, not a startup.
                            It&apos;s free, and the source is open.
                        </p>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <Suspense fallback={<SignedOutHeroCta />}>
                                <HeroCta />
                            </Suspense>
                        </div>
                    </div>
                    <Image
                        src="/mascot/artie-welcome-cutout.png"
                        alt="Artie the mascot, waving"
                        width={360}
                        height={360}
                        className="mx-auto w-full max-w-[280px] md:max-w-[360px] md:justify-self-end"
                    />
                </div>
            </div>

            <section
                id="tools"
                className="mx-auto flex max-w-[1120px] scroll-mt-20 flex-col gap-7 px-6 py-16 md:px-10"
            >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-6">
                    <div className="flex flex-col gap-2">
                        <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                            The tools
                        </div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Six modules. Turn on the ones you need.
                        </h2>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                        <p className="max-w-[32ch] text-sm leading-relaxed text-muted-foreground">
                            Every module is scoped to an organisation. Admin is always on; the rest
                            are switched per org in settings.
                        </p>
                        <Link
                            href="/tools"
                            className="text-sm font-medium underline underline-offset-4 hover:text-foreground"
                        >
                            See all tools
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {orgModules.map((mod) => {
                        const Icon = mod.icon;
                        const badge = mod.alwaysOn
                            ? "ALWAYS ON"
                            : NEEDS_D4H.has(mod.id)
                              ? "NEEDS D4H"
                              : null;
                        return (
                            <div
                                key={mod.id}
                                className="flex gap-3.5 rounded-lg border border-border bg-card p-[18px]"
                            >
                                <Icon className="mt-0.5 size-5 shrink-0 opacity-75" />
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[15px] font-medium">{mod.label}</span>
                                        {badge && (
                                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                                {badge}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        {MODULE_COPY[mod.id]}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="mx-auto max-w-[1120px] px-6 pb-16 md:px-10">
                <ProductShot id={PRODUCT_SHOT_ID} />
            </section>

            <div id="d4h" className="scroll-mt-20 border-y border-border bg-muted/40">
                <section className="mx-auto grid max-w-[1120px] grid-cols-1 gap-10 px-6 py-14 md:grid-cols-2 md:px-10">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2.5">
                            <Cable className="size-4 opacity-75" />
                            <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                                D4H integration
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">
                            Already on D4H? Point AVUT at it.
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            Add a read-only access token and AVUT reads your members, equipment and
                            activities straight from D4H, so nothing gets re-typed and nothing gets
                            written back. D4H Views and I3 both build on that connection; Admin,
                            Skill Track, Notes and the Skill Package Builder stand on their own.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2.5">
                            <Tag className="size-4 opacity-75" />
                            <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                                What it costs
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">
                            Nothing. There&apos;s no plan to price.
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            No seats, no tiers, no trial clock. AVUT exists because the tools were
                            needed; if that changes you&apos;ll hear it here first, and your data
                            comes out the way it went in.
                        </p>
                    </div>
                </section>
            </div>

            <section
                id="questions"
                className="mx-auto grid max-w-[1120px] scroll-mt-20 grid-cols-1 gap-8 px-6 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-10 md:px-10"
            >
                <div className="flex flex-col gap-2">
                    <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        Questions
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight">The honest answers.</h2>
                </div>
                <div className="flex flex-col border-b border-border">
                    {FAQ.map((item) => (
                        <div
                            key={item.q}
                            className="flex flex-col gap-1.5 border-t border-border py-[18px]"
                        >
                            <div className="text-[15px] font-medium">{item.q}</div>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {item.a}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <OssBanner />
        </>
    );
}
