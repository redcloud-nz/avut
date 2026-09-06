/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { SkillsIcons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { SkillCheckResultValue } from "@/lib/schemas/skill-check";

/** Distinct icon + color per exact result value, so tiers within a family read at a glance. */
export const RESULT_ICONS: Record<
    SkillCheckResultValue,
    { Icon: typeof SkillsIcons.Pass; className: string }
> = {
    NotTaught: { Icon: SkillsIcons.NotTaught, className: "text-gray-500" },
    LowFail: { Icon: SkillsIcons.LowFail, className: "text-red-500" },
    Fail: { Icon: SkillsIcons.Fail, className: "text-orange-500" },
    HighFail: { Icon: SkillsIcons.HighFail, className: "text-gray-400" },
    WeakPass: { Icon: SkillsIcons.WeakPass, className: "text-gray-400" },
    Pass: { Icon: SkillsIcons.Pass, className: "text-green-500" },
    StrongPass: { Icon: SkillsIcons.StrongPass, className: "text-blue-500" },
    Exempt: { Icon: SkillsIcons.NotTaught, className: "text-gray-500" },
    Expired: { Icon: SkillsIcons.NotTaught, className: "text-gray-500" },
    Provisional: { Icon: SkillsIcons.NotTaught, className: "text-gray-500" },
};

/** The result's icon in its family colour. */
export function SkillCheckResultIcon({
    result,
    className,
}: {
    result: SkillCheckResultValue;
    className?: string;
}) {
    const { Icon, className: colorClassName } = RESULT_ICONS[result];
    return <Icon className={cn("size-4 shrink-0", colorClassName, className)} />;
}
