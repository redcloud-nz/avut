/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

//import { ComponentProps } from "react";
//import { match } from "ts-pattern";

//import { SkillCheckCompetentIcon, SkillCheckHighlyConfidentIcon, SkillCheckNotAssessedIcon, SkillCheckNotCompetentIcon, SkillCheckNotTaughtIcon } from '@/components/icons'

//import { cn } from './utils'

export type CompetenceLevel =
    | "NotAssessed"
    | "NotTaught"
    | "NotCompetent"
    | "Competent"
    | "HighlyConfident";

export const CompetenceLevels = [
    "NotAssessed",
    "NotTaught",
    "NotCompetent",
    "Competent",
    "HighlyConfident",
] as const;

export const CompetenceLevelTerms: Record<CompetenceLevel, string> = {
    NotAssessed: "Not Assessed",
    NotTaught: "Not Taught",
    NotCompetent: "Not Competent",
    Competent: "Competent",
    HighlyConfident: "Highly Confident",
};

export const CompetenceLevelDescriptions: Record<CompetenceLevel, string> = {
    NotAssessed: "This skill has not yet been assessed.",
    NotTaught: "Training not complete for skill.",
    NotCompetent: "Unable to complete or required assistance.",
    Competent: "Able to complete unassisted.",
    HighlyConfident: "Able to complete unassisted and teach others.",
};

export type CompetenceStatus =
    | "None"
    | "NotCompetent"
    | "Competent"
    | "Expired";

// export class CurrentCompetencyCalculator {
//     private readonly skillPackages: (SkillPackageData & { skillGroups: SkillGroupData[], skills: SkillData[] })[]
//     private readonly skillChecks: SkillCheckData[]

//     constructor(context: { skillPackages: (SkillPackageData & { skillGroups: SkillGroupData[], skills: SkillData[] })[], skillChecks: SkillCheckData[] }) {
//         this.skillPackages = context.skillPackages
//         this.skillChecks = context.skillChecks.sort((a, b) => a.date.localeCompare(b.date))
//     }

//     private getSkillChecks(args: { assesseeId: string, skillId: string }): SkillCheckData[] {
//         return this.skillChecks
//             .filter(check => check.assesseeId === args.assesseeId && check.skillId === args.skillId)
//     }
// }

export function isPass(level: CompetenceLevel): boolean {
    return level === "Competent" || level === "HighlyConfident";
}

// export function CompetenceLevelIndicator({ className, level, ...props }: ComponentProps<typeof SkillCheckNotAssessedIcon> & { level: CompetenceLevel }) {
//     return match(level)
//         .with('NotAssessed', () => <SkillCheckNotAssessedIcon className={cn("size-4 text-gray-600/50", className)} {...props}/>)
//         .with('NotTaught', () => <SkillCheckNotTaughtIcon className={cn("size-4 text-gray-600/50", className)} {...props}/>)
//         .with('NotCompetent', () => <SkillCheckNotCompetentIcon className={cn("size-4 text-red-600/50", className)} {...props}/>)
//         .with('Competent', () => <SkillCheckCompetentIcon className={cn("size-4 text-green-600/50", className)} {...props}/>)
//         .with('HighlyConfident', () => <SkillCheckHighlyConfidentIcon className={cn("size-4 text-blue-600/50", className)} {...props}/>)
//         .exhaustive()

// }
