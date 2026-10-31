/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { TeamData, TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { buildNotifyPatch, OrganizationSettings_UpdateI3Notify_Dialog } from "./update-i3-notify";
import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

vi.mock("./use-organization-settings-mutation", () => ({
    useOrganizationSettingsMutation: vi.fn(),
}));

const mockUseMutation = vi.mocked(useOrganizationSettingsMutation);
const mutate = vi.fn();

const ORG_ID = OrganizationId.create();

const ALICE = PersonId.create();
const BOB = PersonId.create();
const CAROL = PersonId.create();
const GONE = PersonId.create();

const SHOWN_TEAM = TeamId.create();
const UNLINKED_TEAM = TeamId.create();
const ARCHIVED_TEAM = TeamId.create();
const DELETED_TEAM = TeamId.create();

function person(id: PersonId, name: string, status: PersonData["status"] = "Active"): PersonData {
    return {
        id,
        name,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        status,
    } as PersonData;
}

function team(id: TeamId, name: string, opts: { linked: boolean; status?: TeamData["status"] }) {
    return {
        id,
        name,
        status: opts.status ?? "Active",
        d4h: opts.linked
            ? {
                  d4hTeamId: 1,
                  d4hTeamName: name,
                  d4hServerCode: "ap",
                  d4hOrganisationId: null,
                  d4hOrganisationName: null,
                  d4hTimezone: null,
                  lastSyncedAt: null,
              }
            : null,
    } as unknown as TeamData;
}

const PERSONNEL = [
    person(ALICE, "Alice Adams"),
    person(BOB, "Bob Brown", "Archived"),
    person(CAROL, "Carol Clark"),
];

const TEAMS = [
    team(SHOWN_TEAM, "Shown Team", { linked: true }),
    team(UNLINKED_TEAM, "Unlinked Team", { linked: false }),
    team(ARCHIVED_TEAM, "Archived Team", { linked: true, status: "Archived" }),
];

function renderDialog() {
    const defaults = OrganizationSettings.default();
    const settings: OrganizationSettings = {
        ...defaults,
        modules: {
            ...defaults.modules,
            "d4h-i3": {
                ...defaults.modules["d4h-i3"],
                enabled: true,
                notify: {
                    org: [ALICE, BOB, GONE],
                    teams: {
                        [SHOWN_TEAM]: [CAROL],
                        [UNLINKED_TEAM]: [ALICE],
                        [ARCHIVED_TEAM]: [CAROL],
                        [DELETED_TEAM]: [BOB],
                    },
                },
            },
        },
    };

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(
        trpc.personnel.listPersonnel.queryKey({ organizationId: ORG_ID }),
        PERSONNEL,
    );
    queryClient.setQueryData(trpc.teams.listTeams.queryKey({ organizationId: ORG_ID }), TEAMS);

    return render(
        <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter searchParams="?action=update-i3-notify">
                <OrganizationSettings_UpdateI3Notify_Dialog
                    organizationId={ORG_ID}
                    settings={settings}
                    description="Who is emailed."
                />
            </NuqsTestingAdapter>
        </QueryClientProvider>,
    );
}

describe("OrganizationSettings_UpdateI3Notify_Dialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseMutation.mockReturnValue({
            mutate,
            reset: vi.fn(),
            status: "idle",
        } as unknown as ReturnType<typeof useOrganizationSettingsMutation>);
    });

    it("shows only Active, D4H-linked teams, with archived and unknown people marked", async () => {
        renderDialog();

        const dialog = await screen.findByRole("dialog", { name: "I3 Notifications" });
        expect(within(dialog).getByText("Shown Team")).toBeInTheDocument();
        expect(within(dialog).queryByText("Unlinked Team")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("Archived Team")).not.toBeInTheDocument();
        expect(within(dialog).getByText("Archived")).toBeInTheDocument();
        expect(within(dialog).getByText("Unknown person")).toBeInTheDocument();
    });

    it("carries over hidden team entries and drops emptied ones on save", async () => {
        const user = userEvent.setup();
        renderDialog();

        const dialog = await screen.findByRole("dialog", { name: "I3 Notifications" });
        await user.click(
            within(dialog).getByRole("button", { name: "Remove Carol Clark from Shown Team" }),
        );
        await user.click(
            within(dialog).getByRole("button", {
                name: "Remove Unknown person from Whole organisation",
            }),
        );
        await user.click(within(dialog).getByRole("button", { name: "Save" }));

        expect(mutate).toHaveBeenCalledExactlyOnceWith({
            organizationId: ORG_ID,
            update: {
                slice: "modules.d4h-i3",
                patch: {
                    notify: {
                        org: [ALICE, BOB],
                        teams: {
                            [UNLINKED_TEAM]: [ALICE],
                            [ARCHIVED_TEAM]: [CAROL],
                            [DELETED_TEAM]: [BOB],
                        },
                    },
                },
            },
        });
    });
});

describe("buildNotifyPatch", () => {
    it("drops stored and shown teams with empty lists", () => {
        expect(
            buildNotifyPatch(
                { org: [], teams: { [UNLINKED_TEAM]: [], [ARCHIVED_TEAM]: [CAROL] } },
                {
                    org: [ALICE],
                    teams: [{ teamId: SHOWN_TEAM, personIds: [] }],
                },
            ),
        ).toEqual({ org: [ALICE], teams: { [ARCHIVED_TEAM]: [CAROL] } });
    });

    it("dedupes each list", () => {
        expect(
            buildNotifyPatch(
                { org: [], teams: { [ARCHIVED_TEAM]: [CAROL, CAROL] } },
                {
                    org: [ALICE, ALICE],
                    teams: [{ teamId: SHOWN_TEAM, personIds: [CAROL, ALICE, CAROL] }],
                },
            ),
        ).toEqual({
            org: [ALICE],
            teams: { [ARCHIVED_TEAM]: [CAROL], [SHOWN_TEAM]: [CAROL, ALICE] },
        });
    });
});
