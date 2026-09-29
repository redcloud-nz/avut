/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import {
    ClipboardCheckIcon,
    ListChecksIcon,
    SlidersHorizontalIcon,
    UserCheckIcon,
    UserIcon,
    UsersIcon,
    type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useId, useRef, useState } from "react";

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

type SessionEntryMode = "by-person" | "by-skill";

const CONFIG_ITEMS: { action: SessionConfigAction; label: string; icon: LucideIcon }[] = [
    { action: "change-personnel", label: "Change personnel", icon: UsersIcon },
    { action: "change-skills", label: "Change skills", icon: ListChecksIcon },
    { action: "change-assessors", label: "Change assessors", icon: UserCheckIcon },
];

const MODE_ITEMS: { mode: SessionEntryMode; label: string; icon: LucideIcon }[] = [
    { mode: "by-person", label: "By Person", icon: UserIcon },
    { mode: "by-skill", label: "By Skill", icon: ClipboardCheckIcon },
];

/**
 * The "Actions" navbar button on the skill check entry pages, and the side sheet it opens:
 * change the session's personnel, skills or assessors, or switch between recording modes.
 *
 * The sheet is local state, not a URL param — `?action=` belongs to the dialog a sheet item
 * opens. Choosing a "change X" item closes the sheet and opens its dialog, which is hosted here
 * as a sibling of the sheet (anything inside `SheetContent` unmounts when the sheet closes).
 * The item that opened the dialog is gone by then, so the dialogs return focus to the Actions
 * button on close.
 */
export function SkillTrack_SessionActionsSheet({
    sessionId,
    mode,
}: {
    sessionId: SkillCheckSessionId;
    mode: SessionEntryMode;
}) {
    const organization = useOrganization();
    const { open: openConfigDialog } = useSessionConfigAction();

    const [sheetOpen, setSheetOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const routeParams = { slug: organization.slug, session_id: sessionId };
    const modeHrefs: Record<SessionEntryMode, Route> = {
        "by-person": route("/orgs/[slug]/skill-track/sessions/[session_id]/by-person", routeParams),
        "by-skill": route("/orgs/[slug]/skill-track/sessions/[session_id]/by-skill", routeParams),
    };

    const configureHeadingId = useId();
    const recordHeadingId = useId();

    // Set while a "change X" item hands over to its dialog, so the closing sheet doesn't pull
    // focus back to the Actions button underneath the dialog that is opening.
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
                    <Button ref={triggerRef} variant="ghost">
                        <SlidersHorizontalIcon />
                        <span className="sr-only sm:not-sr-only">Actions</span>
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
                            Change this session, or switch how you record checks.
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
                            <ItemGroup className="gap-0">
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
                                                    disabled={!hasPermission}
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
                            <ItemGroup className="gap-0">
                                {MODE_ITEMS.map(({ mode: itemMode, label, icon: Icon }) => {
                                    const current = itemMode === mode;
                                    return (
                                        <Item
                                            key={itemMode}
                                            asChild
                                            size="sm"
                                            variant={current ? "outline" : "default"}
                                        >
                                            <Link
                                                href={modeHrefs[itemMode]}
                                                aria-current={current ? "page" : undefined}
                                                onClick={() => setSheetOpen(false)}
                                            >
                                                <ItemMedia variant="icon">
                                                    <Icon />
                                                </ItemMedia>
                                                <ItemContent>
                                                    <ItemTitle>{label}</ItemTitle>
                                                </ItemContent>
                                            </Link>
                                        </Item>
                                    );
                                })}
                            </ItemGroup>
                        </section>
                    </div>
                </SheetContent>
            </Sheet>
            <SkillTrack_SessionConfigDialogs sessionId={sessionId} returnFocusRef={triggerRef} />
        </>
    );
}
