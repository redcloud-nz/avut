/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { route } from "@/lib/routes";
import { UserData } from "@/lib/schemas/user";

import { EntityLink } from "./entity-link";

export type UserLinkProps = {
    user: Pick<UserData, "id" | "name"> & Partial<Pick<UserData, "email">>;
};

export function UserLink({ user }: UserLinkProps) {
    return (
        <EntityLink
            href={route("/system/admin/users/[user_id]", { user_id: user.id })}
            title={user.name}
            type="User"
        >
            {user.email && <span className="text-muted-foreground">{user.email}</span>}
        </EntityLink>
    );
}
