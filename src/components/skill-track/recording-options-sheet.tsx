/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import {
    ArrowDownAZIcon,
    ClipboardCheckIcon,
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
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
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

/** The entry page's view options, which the sheet's Skill Order group displays and changes. */
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
 * The "Options" button in the header of the skill check entry pages, and the Recording Options
 * sheet it opens: switch between recording modes (`mode` is the page's own, marked as current),
 * change how the page lists skills (`view`, owned by the page), or change the session's
 * personnel, skills or assessors.
 *
 * The sheet is local state, not a URL param — `?action=` belongs to the dialog a sheet item
 * opens. Choosing a "change X" item closes the sheet and opens its dialog, which is hosted here as
 * a sibling of the sheet (anything inside `SheetContent` unmounts when the sheet closes). The item
 * that opened the dialog is gone by then, so the dialogs return focus to the Options button.
 *
 * The Recording Mode and Configure Session items are disabled while the session is approved: its
 * checks and config are locked until it's reopened.
 */
export function SkillTrack_RecordingOptionsSheet({
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
    const orderHeadingId = useId();

    // Set while a "change X" item hands over to its dialog, so the closing sheet doesn't pull
    // focus back to the Options button underneath the dialog that is opening.
    const handingOverRef = useRef(false);

    function handleConfigure(action: SessionConfigAction) {
        handingOverRef.current = true;
        setSheetOpen(false);
        openConfigDialog(action);
    }

    return (
        <>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                    <Button ref={triggerRef} variant="outline">
                        <SlidersHorizontalIcon />
                        <span className="sr-only md:not-sr-only">Options</span>
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
                        <SheetTitle>Recording Options</SheetTitle>
                        <SheetDescription>
                            Switch how you record checks, change how skills are listed, or change
                            this session.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4 flex flex-col gap-6 [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)]">
                        <section aria-labelledby={recordHeadingId} className="flex flex-col gap-1">
                            <h3
                                id={recordHeadingId}
                                className="px-3 text-xs font-medium text-muted-foreground"
                            >
                                Recording Mode
                            </h3>
                            {isApproved && (
                                <p className="px-3 text-xs text-muted-foreground">
                                    Locked while the session is approved
                                </p>
                            )}
                            <div className="flex gap-2 px-1 *:flex-1">
                                {MODE_ITEMS.map(({ mode: itemMode, label, icon: Icon }) => {
                                    const current = itemMode === mode;
                                    const content = (
                                        <>
                                            <Icon className="size-5" />
                                            <span className="text-muted-foreground">{label}</span>
                                        </>
                                    );
                                    return (
                                        <Button
                                            key={itemMode}
                                            asChild={!isApproved}
                                            variant={current ? "outline" : "ghost"}
                                            disabled={isApproved}
                                            aria-current={
                                                isApproved && current ? "page" : undefined
                                            }
                                            className="h-auto min-w-0 flex-col justify-start gap-1.5 px-1 py-1.5 text-xs leading-tight font-normal whitespace-normal"
                                        >
                                            {isApproved ? (
                                                content
                                            ) : (
                                                <Link
                                                    href={modeHrefs[itemMode]}
                                                    aria-current={current ? "page" : undefined}
                                                    onClick={() => setSheetOpen(false)}
                                                >
                                                    {content}
                                                </Link>
                                            )}
                                        </Button>
                                    );
                                })}
                            </div>
                        </section>

                        <section aria-labelledby={orderHeadingId} className="flex flex-col gap-1">
                            <h3
                                id={orderHeadingId}
                                className="px-3 text-xs font-medium text-muted-foreground"
                            >
                                Skill Order
                            </h3>
                            <div
                                role="group"
                                aria-labelledby={orderHeadingId}
                                className="flex gap-2 px-1 *:flex-1"
                            >
                                {SKILL_ORDER_ITEMS.map(({ value, label, icon: Icon }) => {
                                    const isSelected = value === view.skillOrder;
                                    return (
                                        <Button
                                            key={value}
                                            variant={isSelected ? "outline" : "ghost"}
                                            aria-pressed={isSelected}
                                            className="h-auto min-w-0 flex-col justify-start gap-1.5 px-1 py-1.5 text-xs leading-tight font-normal whitespace-normal"
                                            onClick={() => view.onSkillOrderChange(value)}
                                        >
                                            <Icon className="size-5" />
                                            <span className="text-muted-foreground">{label}</span>
                                        </Button>
                                    );
                                })}
                            </div>
                        </section>

                        <section
                            aria-labelledby={configureHeadingId}
                            className="flex flex-col gap-1"
                        >
                            <h3
                                id={configureHeadingId}
                                className="px-3 text-xs font-medium text-muted-foreground"
                            >
                                Configure Session
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
                    </div>
                </SheetContent>
            </Sheet>
            <SkillTrack_SessionConfigDialogs sessionId={sessionId} returnFocusRef={triggerRef} />
        </>
    );
}
