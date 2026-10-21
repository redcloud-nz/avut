/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { SkillLink } from "@/components/entity-links/skill-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SkillRef } from "@/lib/schemas/skill";

type SkillListSkill = SkillRef & {
    description: string;
    defaultInclude: boolean;
    defaultRequired: boolean;
    /** Left out where only active skills are listed. */
    status?: string;
};

/**
 * A card of flat skill rows — name (linked), its default flags as badges, and its description —
 * shared by the catalogue package's Contents and a group's Skills.
 */
export function SkillTrack_SkillList({ skills }: { skills: SkillListSkill[] }) {
    if (skills.length === 0) {
        return <p className="text-muted-foreground text-sm">No skills in this group.</p>;
    }

    return (
        <Card className="py-0">
            <ul className="divide-y divide-border/50">
                {skills.map((skill) => (
                    <li key={skill.id} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                                <SkillLink skill={skill} />
                            </span>
                            {skill.status && skill.status !== "Active" && (
                                <Badge variant="outline">Archived</Badge>
                            )}
                            {skill.defaultRequired && <Badge variant="secondary">Required</Badge>}
                            {!skill.defaultInclude && (
                                <Badge variant="outline">Not included by default</Badge>
                            )}
                        </div>
                        {skill.description && (
                            <p className="text-muted-foreground mt-0.5 text-sm">
                                {skill.description}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </Card>
    );
}
