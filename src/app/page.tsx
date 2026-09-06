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
import { SiGithub } from "@icons-pack/react-simple-icons";

import { Button } from "@/components/ui/button";
import { CopyrightString } from "@/components/ui/copyright";
import { ExternalLink } from "@/components/ui/link";
import { VersionString } from "@/components/ui/version-string";
import { orgModules } from "@/lib/modules";
import { getSession } from "@/server/session";

const REPO_URL =
    process.env.NEXT_PUBLIC_APP_REPOSITORY_URL ?? "https://github.com/redcloud-nz/avut";
const REPO_SLUG = REPO_URL.replace(/^https?:\/\/github\.com\//, "");

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
 * seeded demo org (`prisma/seed-demo.ts`), captured at 1440×900.
 */
const PRODUCT_SHOT: {
    src: string;
    alt: string;
    /** Fake address-bar path shown in the browser chrome. */
    urlPath: string;
} | null = {
    src: "/marketing/skill-track-session.png",
    alt: "Skill Track: recording a Rope Rescue Technician assessment session",
    urlPath: "avut.app/orgs/your-team/skill-track/sessions/…/by-person",
};

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

/**
 * `getSession()` is wrapped in React `cache()`, so checking it twice per request
 * (header + hero) costs one lookup, not two. Deliberately the real, DB-validated
 * check rather than the cheap `getSessionCookie()` presence check — a stale or
 * revoked cookie must not show "Open AVUT" for a session that's actually dead.
 * Each call site owns its own `<Suspense>` boundary so this is the *only*
 * dynamic part of the page; see #96 for why that doesn't yet buy a cached
 * static shell for the rest of it.
 */
async function hasActiveSession(): Promise<boolean> {
    return (await getSession()) != null;
}

function SignedOutHeaderCta() {
    return (
        <>
            <Button asChild variant="outline">
                <Link href="/auth/sign-in">Sign In</Link>
            </Button>
            <Button asChild>
                <Link href="/auth/sign-up">Sign Up</Link>
            </Button>
        </>
    );
}

async function HeaderCta() {
    if (!(await hasActiveSession())) return <SignedOutHeaderCta />;
    return (
        <Button asChild>
            <Link href="/orgs/--select-org">Open AVUT</Link>
        </Button>
    );
}

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
        <div className="min-h-svh w-full bg-background text-foreground">
            <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
                <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-6 px-6 py-3.5 md:px-10">
                    <Link href="#top" className="shrink-0">
                        <Image
                            src="/avut-logo.svg"
                            alt="A.V.U.T."
                            width={96}
                            height={32}
                            className="h-auto w-24 dark:invert"
                        />
                    </Link>
                    <nav className="flex items-center gap-5 text-sm text-muted-foreground">
                        <a href="#tools" className="hidden sm:inline hover:text-foreground">
                            Tools
                        </a>
                        <a href="#d4h" className="hidden sm:inline hover:text-foreground">
                            D4H
                        </a>
                        <a href="#questions" className="hidden sm:inline hover:text-foreground">
                            Questions
                        </a>
                        <ExternalLink
                            href={REPO_URL}
                            noDecoration
                            className="hidden sm:inline hover:text-foreground"
                        >
                            GitHub
                        </ExternalLink>
                        <div className="flex items-center gap-1.5">
                            <Suspense fallback={<SignedOutHeaderCta />}>
                                <HeaderCta />
                            </Suspense>
                        </div>
                    </nav>
                </div>
            </header>

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
                    <p className="max-w-[32ch] text-sm leading-relaxed text-muted-foreground">
                        Every module is scoped to an organisation. Admin is always on; the rest are
                        switched per org in settings.
                    </p>
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

            {PRODUCT_SHOT && (
                <section className="mx-auto max-w-[1120px] px-6 pb-16 md:px-10">
                    <div className="overflow-hidden rounded-lg border border-border">
                        <div className="flex h-10 items-center gap-2 border-b border-border bg-muted px-3.5 font-mono text-[11px] text-muted-foreground">
                            <span className="size-2 rounded-full bg-border" />
                            <span className="size-2 rounded-full bg-border" />
                            <span className="size-2 rounded-full bg-border" />
                            <span className="ml-2.5 truncate">{PRODUCT_SHOT.urlPath}</span>
                        </div>
                        <Image
                            src={PRODUCT_SHOT.src}
                            alt={PRODUCT_SHOT.alt}
                            width={1440}
                            height={900}
                            className="w-full"
                        />
                    </div>
                </section>
            )}

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

            <div className="bg-foreground text-background">
                <section className="mx-auto flex max-w-[1120px] flex-col justify-between gap-6 px-6 py-9 sm:flex-row sm:items-center md:px-10">
                    <div className="flex flex-col gap-1.5">
                        <div className="text-lg font-medium">Open source, MIT licensed.</div>
                        <p className="text-sm leading-relaxed text-background/70">
                            Read the code, file an issue, or run your own copy. Next.js, Postgres,
                            tRPC — nothing exotic.
                        </p>
                    </div>
                    <ExternalLink
                        href={REPO_URL}
                        noDecoration
                        className="inline-flex h-9 shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-md bg-background/10 px-3.5 text-sm font-medium text-background hover:bg-background/20 sm:self-auto"
                    >
                        <SiGithub className="size-4" />
                        {REPO_SLUG}
                    </ExternalLink>
                </section>
            </div>

            <footer className="border-t border-border">
                <div className="mx-auto flex max-w-[1120px] flex-col justify-between gap-4 px-6 py-6 pb-10 text-[13px] text-muted-foreground sm:flex-row sm:items-center md:px-10">
                    <Image
                        src="/avut-logo.svg"
                        alt="A.V.U.T."
                        width={72}
                        height={24}
                        className="h-auto w-[72px] opacity-60 dark:invert"
                    />
                    <div className="flex flex-wrap items-center gap-5">
                        <Link href="/policies/privacy" className="hover:text-foreground">
                            Privacy Policy
                        </Link>
                        <Link href="/policies/terms-of-service" className="hover:text-foreground">
                            Terms of Service
                        </Link>
                        <CopyrightString />
                    </div>
                </div>
            </footer>
        </div>
    );
}
