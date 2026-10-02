/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import {
    ArrowDownAZIcon,
    ClipboardCheckIcon,
    HistoryIcon,
    ListChecksIcon,
    ListTreeIcon,
    SlidersHorizontalIcon,
    UserCheckIcon,
    UserIcon,
    UsersIcon,
    type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Protect } from "@/components/protect";
import {
    SessionConfigAction,
    SkillTrack_SessionConfigDialogs,
    useSessionConfigAction,
} from "@/components/skill-track/session-config-dialogs";
import {
    SkillTrack_SessionRecentChecksDialog,
    useRecentChecksAction,
} from "@/components/skill-track/session-recent-checks-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

type SessionEntryMode = "by-person" | "by-skill";

export type SessionSkillOrder = "alphabetical" | "by-package-group";

/** The entry page's view options, which the sheet's View group displays and changes. */
export interface SessionEntryView {
    skillOrder: SessionSkillOrder;
    onSkillOrderChange: (skillOrder: SessionSkillOrder) => void;
}

const CONFIG_ITEMS: { action: SessionConfigAction; label: string; icon: LucideIcon }[] = [
    { action: "change-personnel", label: "Personnel", icon: UsersIcon },
    { action: "change-skills", label: "Skills", icon: ListChecksIcon },
    { action: "change-assessors", label: "Assessors", icon: UserCheckIcon },
];

const SKILL_ORDER_ITEMS: { value: SessionSkillOrder; label: string; icon: LucideIcon }[] = [
    { value: "alphabetical", label: "Alphabetical", icon: ArrowDownAZIcon },
    { value: "by-package-group", label: "By Package/Group", icon: ListTreeIcon },
];

const MODE_ITEMS: { mode: SessionEntryMode; label: string; icon: LucideIcon }[] = [
    { mode: "by-person", label: "By Person", icon: UserIcon },
    { mode: "by-skill", label: "By Skill", icon: ClipboardCheckIcon },
];

/**
 * The "Actions" navbar button on the skill check entry pages, and the side sheet it opens:
 * change the session's personnel, skills or assessors, switch between recording modes, open the
 * Recent checks dialog, or change how the page lists skills (`view`, owned by the page).
 *
 * The sheet is local state, not a URL param — `?action=` belongs to the dialog a sheet item
 * opens. Choosing a "change X" item or "Recent checks" closes the sheet and opens its dialog,
 * which is hosted here as a sibling of the sheet (anything inside `SheetContent` unmounts when
 * the sheet closes). The item that opened the dialog is gone by then, so the dialogs return focus
 * to the Actions button on close.
 *
 * The Configure and Record items are disabled while the session is approved: its config and checks
 * are locked until it's reopened. Recent checks stays available to anyone who can open the sheet.
 */
export function SkillTrack_SessionActionsSheet({
    sessionId,
    mode,
    view,
}: {
    sessionId: SkillCheckSessionId;
    mode: SessionEntryMode;
    view: SessionEntryView;
}) {
    const organization = useOrganization();
    const { open: openConfigDialog } = useSessionConfigAction();
    const { open: openRecentChecks } = useRecentChecksAction();
    const { data: session } = useSuspenseQuery(
        trpc.skillCheckSessions.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
        }),
    );
    const isApproved = session.status === "Include";

    const [sheetOpen, setSheetOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const routeParams = { slug: organization.slug, session_id: sessionId };
    const modeHrefs: Record<SessionEntryMode, Route> = {
        "by-person": route("/orgs/[slug]/skill-track/sessions/[session_id]/by-person", routeParams),
        "by-skill": route("/orgs/[slug]/skill-track/sessions/[session_id]/by-skill", routeParams),
    };

    const configureHeadingId = useId();
    const recordHeadingId = useId();
    const activityHeadingId = useId();
    const orderHeadingId = useId();
    const idPrefix = useId();

    // Set while a "change X" item hands over to its dialog, so the closing sheet doesn't pull
    // focus back to the Actions button underneath the dialog that is opening.
    const handingOverRef = useRef(false);

    function handleConfigure(action: SessionConfigAction) {
        handingOverRef.current = true;
        setSheetOpen(false);
        openConfigDialog(action);
    }

    function handleRecentChecks() {
        handingOverRef.current = true;
        setSheetOpen(false);
        openRecentChecks();
    }

    return (
        <>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                    <Button ref={triggerRef} variant="ghost" size="icon">
                        <SlidersHorizontalIcon />
                        <span className="sr-only">Actions</span>
                    </Button>
                </SheetTrigger>
                <SheetContent
                    side="right"
                    className="w-full gap-0 sm:max-w-sm"
                    onCloseAutoFocus={(event) => {
                        if (handingOverRef.current) {
                            event.preventDefault();
                            handingOverRef.current = false;
                        }
                    }}
                >
                    <SheetHeader className="border-b">
                        <SheetTitle>Actions</SheetTitle>
                        <SheetDescription>
                            Change this session, switch how you record checks, or change how skills
                            are listed.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4 flex flex-col gap-6 [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)]">
                        <section
                            aria-labelledby={configureHeadingId}
                            className="flex flex-col gap-1"
                        >
                            <h3
                                id={configureHeadingId}
                                className="px-3 text-xs font-medium text-muted-foreground"
                            >
                                Configure
                            </h3>
                            <ItemGroup className="gap-0 has-data-[size=sm]:gap-0">
                                {CONFIG_ITEMS.map(({ action, label, icon: Icon }) => (
                                    <Protect
                                        key={action}
                                        permissions={{ skillCheckSession: ["update"] }}
                                        render={(hasPermission) => (
                                            <Item
                                                asChild
                                                size="sm"
                                                className="text-left enabled:hover:bg-muted disabled:opacity-50"
                                            >
                                                <button
                                                    type="button"
                                                    disabled={!hasPermission || isApproved}
                                                    onClick={() => handleConfigure(action)}
                                                >
                                                    <ItemMedia variant="icon">
                                                        <Icon />
                                                    </ItemMedia>
                                                    <ItemContent>
                                                        <ItemTitle>{label}</ItemTitle>
                                                    </ItemContent>
                                                </button>
                                            </Item>
                                        )}
                                    />
                                ))}
                            </ItemGroup>
                        </section>

                        <section aria-labelledby={recordHeadingId} className="flex flex-col gap-1">
                            <h3
                                id={recordHeadingId}
                                className="px-3 text-xs font-medium text-muted-foreground"
                            >
                                Record
                            </h3>
                            {isApproved && (
                                <p className="px-3 text-xs text-muted-foreground">
                                    Locked while the session is approved
                                </p>
                            )}
                            <ItemGroup className="gap-0 has-data-[size=sm]:gap-0">
                                {MODE_ITEMS.map(({ mode: itemMode, label, icon: Icon }) => {
                                    const current = itemMode === mode;
                                    const content = (
                                        <>
                                            <ItemMedia variant="icon">
                                                <Icon />
                                            </ItemMedia>
                                            <ItemContent>
                                                <ItemTitle>{label}</ItemTitle>
                                            </ItemContent>
                                        </>
                                    );
                                    return (
                                        <Item
                                            key={itemMode}
                                            asChild
                                            size="sm"
                                            variant={current ? "outline" : "default"}
                                            className={
                                                isApproved
                                                    ? "text-left disabled:opacity-50"
                                                    : undefined
                                            }
                                        >
                                            {isApproved ? (
                                                <button
                                                    type="button"
                                                    disabled
                                                    aria-current={current ? "page" : undefined}
                                                >
                                                    {content}
                                                </button>
                                            ) : (
                                                <Link
                                                    href={modeHrefs[itemMode]}
                                                    aria-current={current ? "page" : undefined}
                                                    onClick={() => setSheetOpen(false)}
                                                >
                                                    {content}
                                                </Link>
                                            )}
                                        </Item>
                                    );
                                })}
                            </ItemGroup>
                        </section>

                        <section
                            aria-labelledby={activityHeadingId}
                            className="flex flex-col gap-1"
                        >
                            <h3
                                id={activityHeadingId}
                                className="px-3 text-xs font-medium text-muted-foreground"
                            >
                                Activity
                            </h3>
                            <ItemGroup className="gap-0 has-data-[size=sm]:gap-0">
                                <Item
                                    asChild
                                    size="sm"
                                    className="text-left enabled:hover:bg-muted"
                                >
                                    <button type="button" onClick={handleRecentChecks}>
                                        <ItemMedia variant="icon">
                                            <HistoryIcon />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle>Recent checks</ItemTitle>
                                        </ItemContent>
                                    </button>
                                </Item>
                            </ItemGroup>
                        </section>

                        <section aria-labelledby={orderHeadingId} className="flex flex-col gap-2">
                            <h3
                                id={orderHeadingId}
                                className="px-3 text-xs font-medium text-muted-foreground"
                            >
                                Skill Order
                            </h3>
                            <RadioGroup
                                aria-labelledby={orderHeadingId}
                                className="px-3"
                                value={view.skillOrder}
                                onValueChange={(value) =>
                                    view.onSkillOrderChange(value as SessionSkillOrder)
                                }
                            >
                                {SKILL_ORDER_ITEMS.map(({ value, label, icon: Icon }) => (
                                    <Field key={value} orientation="horizontal">
                                        <RadioGroupItem
                                            value={value}
                                            id={`${idPrefix}-order-${value}`}
                                        />
                                        <FieldLabel
                                            htmlFor={`${idPrefix}-order-${value}`}
                                            className="font-normal"
                                        >
                                            <Icon className="size-4 text-muted-foreground" />
                                            {label}
                                        </FieldLabel>
                                    </Field>
                                ))}
                            </RadioGroup>
                        </section>
                    </div>
                </SheetContent>
            </Sheet>
            <SkillTrack_SessionConfigDialogs sessionId={sessionId} returnFocusRef={triggerRef} />
            <SkillTrack_SessionRecentChecksDialog
                sessionId={sessionId}
                returnFocusRef={triggerRef}
            />
        </>
    );
}
