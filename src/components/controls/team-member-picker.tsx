/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useQuery } from "@tanstack/react-query";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/hooks/use-organization";
import { PersonRef } from "@/lib/schemas/person";
import { TeamMembershipData } from "@/lib/schemas/team-membership";
import { trpc } from "@/trpc/client";

interface TeamMemberPickerProps {
    teamId: string;

    className?: string;

    defaultValue?: string;

    exclude?: string[];

    onValueChange?: (
        membership: TeamMembershipData & { person: PersonRef },
    ) => void;

    placeholder?: string;

    size?: "default" | "sm";

    status?: ("Active" | "Inactive")[];

    value?: string;
}

export function TeamMemberPicker({
    teamId,
    className,
    defaultValue = "",
    exclude = [],
    onValueChange,
    placeholder,
    size,
    status = ["Active"],
    value,
}: TeamMemberPickerProps) {
    const organization = useOrganization();

    const teamMembersQuery = useQuery(
        trpc.teamMemberships.getTeamMemberships.queryOptions({
            teamId,
            status,
            orgId: organization.orgId,
        }),
    );

    const teamMembers = teamMembersQuery.data || [];

    function handleValueChange(memberId: string) {
        const member = teamMembers.find((m) => m.personId === memberId);
        if (member && onValueChange) {
            onValueChange(member);
        }
    }

    return (
        <Select
            defaultValue={defaultValue}
            onValueChange={handleValueChange}
            value={value}
        >
            <SelectTrigger className={className} size={size}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {teamMembers.map((member) => (
                    <SelectItem
                        key={member.personId}
                        value={member.personId}
                        disabled={exclude.includes(member.personId)}
                    >
                        {member.person.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
