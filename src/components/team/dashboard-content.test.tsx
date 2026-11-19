/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it, vi } from "vitest";

import { useSuspenseQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";

import { RosterCard } from "./dashboard-content";

vi.mock("@tanstack/react-query", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@tanstack/react-query")>()),
    useSuspenseQuery: vi.fn(),
}));
vi.mock("@/trpc/client", () => ({
    trpc: { teams: { listTeamMemberships: { queryOptions: vi.fn(() => ({})) } } },
}));

type Status = "Active" | "Archived" | "Deleted";

function row(name: string, membershipStatus: Status, personStatus: Status) {
    return {
        id: TeamMembershipId.create(),
        status: membershipStatus,
        person: { id: PersonId.create(), name, email: null, status: personStatus },
        d4h: null,
    };
}

describe("RosterCard", () => {
    it("lists only Active memberships of Active people", () => {
        vi.mocked(useSuspenseQuery).mockReturnValue({
            data: [
                row("Amy Active", "Active", "Active"),
                row("Arnie Archived-membership", "Archived", "Active"),
                row("Pat Archived-person", "Active", "Archived"),
                row("Bea Binned-person", "Active", "Deleted"),
            ],
        } as never);

        render(<RosterCard organizationId={OrganizationId.create()} teamId={TeamId.create()} />);

        expect(screen.getByText("Amy Active")).toBeTruthy();
        expect(screen.queryByText("Arnie Archived-membership")).toBeNull();
        expect(screen.queryByText("Pat Archived-person")).toBeNull();
        expect(screen.queryByText("Bea Binned-person")).toBeNull();
    });

    it("shows the empty state when no one qualifies", () => {
        vi.mocked(useSuspenseQuery).mockReturnValue({
            data: [row("Pat Archived-person", "Active", "Archived")],
        } as never);

        render(<RosterCard organizationId={OrganizationId.create()} teamId={TeamId.create()} />);

        expect(screen.getByText("No one is on this team's roster yet.")).toBeTruthy();
    });
});
