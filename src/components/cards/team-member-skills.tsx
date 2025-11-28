/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { addYears, formatDate, isBefore, subMonths, subYears } from "date-fns";
import { CheckIcon, ClockAlertIcon, SettingsIcon, XIcon } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { randomInteger, sumBy } from "remeda";
import { match } from "ts-pattern";

import { useSuspenseQueries } from "@tanstack/react-query";

import {
    ATable,
    ATableCell,
    ATableSectionContent,
    ATableSection,
    ATableRow,
    ATableTrigger,
    ATableSectionHeader,
    ATableBody,
} from "@/components/ui/accordion-table";
import { Alert } from "@/components/ui/alert";
import { Button, RefreshButton } from "@/components/ui/button";
import {
    Card,
    CardActions,
    CardContent,
    CardExplanation,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { GitHubIssueLink } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";

import {
    createRandomDateGenerator,
    createRandomValueGenerator,
} from "@/lib/generate-values";
import { CompetenceLevel } from "@/lib/competencies";
import { OrganizationData } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

import {
    SkillCheckGeneratorConfig_Card,
    SkillCheckGeneratorConfigData,
} from "./skill-check-generator-config";

export function Team_Member_Skills_Card({
    organization,
    personId,
}: {
    organization: OrganizationData;
    personId: string;
}) {
    const [
        { data: availablePackages, refetch: refetchAvailablePackages },
        { data: teamMembers, refetch: refetchTeamMembers },
    ] = useSuspenseQueries({
        queries: [
            trpc.skills.getAvailablePackages.queryOptions({
                orgId: organization.orgId,
            }),
            trpc.teamMemberships.getTeamMemberships.queryOptions({
                orgId: organization.orgId,
            }),
        ],
    });

    async function handleRefresh() {
        await Promise.all([refetchAvailablePackages(), refetchTeamMembers()]);
    }

    const [generatorConfigOpen, setGeneratorConfigOpen] = useState(false);
    const [generatorConfig, setGeneratorConfig] =
        useState<SkillCheckGeneratorConfigData>({
            statusWeights: {
                NotAssessed: 10,
                NotTaught: 10,
                NotCompetent: 20,
                Competent: 50,
                HighlyConfident: 10,
            },
            dateWeights: {
                Expired: 20,
                RecentlyExpired: 10,
                NearlyExpired: 10,
                OK: 60,
            },
        });

    const skillChecks = useMemo(() => {
        const now = new Date();

        const statusGenerator = createRandomValueGenerator<CompetenceLevel>(
            generatorConfig.statusWeights,
        );
        const dateGenerator = createRandomDateGenerator([
            {
                start: subMonths(now, 24),
                end: subMonths(now, 15),
                weight: generatorConfig.dateWeights.Expired,
            },
            {
                start: subMonths(now, 15),
                end: subMonths(now, 12),
                weight: generatorConfig.dateWeights.RecentlyExpired,
            },
            {
                start: subMonths(now, 12),
                end: subMonths(now, 9),
                weight: generatorConfig.dateWeights.NearlyExpired,
            },
            {
                start: subMonths(now, 9),
                end: now,
                weight: generatorConfig.dateWeights.OK,
            },
        ]);

        return availablePackages.flatMap((skillPackage) =>
            skillPackage.skills.map((skill) => {
                const result = statusGenerator();
                const date = dateGenerator();

                const competent =
                    result === "Competent" || result === "HighlyConfident";
                const expired = isBefore(date, subYears(now, 1));

                return {
                    skillId: skill.skillId,
                    assesseeId: personId,
                    assessorId:
                        teamMembers[randomInteger(0, teamMembers.length - 1)]
                            .personId,
                    result,
                    date,
                    ok: competent && !expired,
                    competent,
                    expired,
                };
            }),
        );
    }, [availablePackages, teamMembers, generatorConfig, personId]);

    const skillPackages = useMemo(() => {
        return availablePackages.flatMap(
            ({ skills, skillGroups, ...skillPackage }) => {
                const processedSkillGroups = skillGroups.map((skillGroup) => {
                    const processedSkills = skills
                        .filter(
                            (skill) =>
                                skill.skillGroupId === skillGroup.skillGroupId,
                        )
                        .map((skill) => {
                            const check = skillChecks.find(
                                (check) =>
                                    check.skillId == skill.skillId &&
                                    check.assesseeId == personId,
                            );

                            return {
                                ...skill,
                                check,
                            };
                        });

                    return {
                        ...skillGroup,
                        skills: processedSkills,
                        aggregates: {
                            okCount: sumBy(processedSkills, (skill) =>
                                skill.check?.ok ? 1 : 0,
                            ),
                            skillsCount: processedSkills.length,
                        },
                    };
                });

                return {
                    ...skillPackage,
                    skillGroups: processedSkillGroups,
                    aggregates: {
                        okCount: sumBy(
                            processedSkillGroups,
                            (group) => group.aggregates.okCount,
                        ),
                        skillsCount: sumBy(
                            processedSkillGroups,
                            (group) => group.aggregates.skillsCount,
                        ),
                    },
                };
            },
        );
    }, [availablePackages, skillChecks, personId]);

    const teamMembersMap = useMemo(() => {
        return new Map(
            teamMembers.map((member) => [member.personId as string, member]),
        );
    }, [teamMembers]);

    const aggregates = {
        okCount: sumBy(skillPackages, (group) => group.aggregates.okCount),
        skillsCount: sumBy(
            skillPackages,
            (group) => group.aggregates.skillsCount,
        ),
    };

    return (
        <>
            <Alert
                severity="mockup"
                title="Design Mockup"
                action={
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                            setGeneratorConfigOpen(!generatorConfigOpen)
                        }
                    >
                        <SettingsIcon />
                    </Button>
                }
            >
                This page is a design mockup that is implemented with randomly
                generated skill checks.
                <p>
                    See <GitHubIssueLink issueNumber={17} /> for feedback or
                    suggestions.
                </p>
            </Alert>
            {generatorConfigOpen && (
                <SkillCheckGeneratorConfig_Card
                    defaultValue={generatorConfig}
                    onApply={setGeneratorConfig}
                    onClose={() => setGeneratorConfigOpen(false)}
                />
            )}
            <Card>
                <CardHeader>
                    <CardTitle>
                        {teamMembersMap.get(personId)?.person.name}
                    </CardTitle>
                    <CardActions>
                        <RefreshButton onClick={handleRefresh} />
                        <Separator orientation="vertical" />
                        <CardExplanation>
                            This card displays the skills for the team member.
                        </CardExplanation>
                    </CardActions>
                </CardHeader>
                <CardContent>
                    <ATable className="grid-cols-[2fr_60px_1fr_1fr_40px]">
                        {/* <ATableHead>
                        <ATableHeadRow>
                            <ATableHeadCell>Package / Group</ATableHeadCell>
                            <ATableHeadCell className="text-center">Status</ATableHeadCell>
                            <ATableHeadCell>Reason</ATableHeadCell>
                        </ATableHeadRow>
                    </ATableHead> */}
                        <ATableBody type="multiple">
                            {skillPackages.map((skillPackage) => (
                                <Fragment key={skillPackage.skillPackageId}>
                                    <ATableRow>
                                        <ATableCell className="font-bold">
                                            {skillPackage.name}
                                        </ATableCell>
                                        <ATableCell className="text-center">
                                            {toPercentage(
                                                skillPackage.aggregates.okCount,
                                                skillPackage.aggregates
                                                    .skillsCount,
                                            )}
                                            %
                                        </ATableCell>
                                    </ATableRow>
                                    {skillPackage.skillGroups.map(
                                        (skillGroup) => {
                                            return (
                                                <ATableSection
                                                    key={
                                                        skillGroup.skillGroupId
                                                    }
                                                    value={
                                                        skillGroup.skillGroupId
                                                    }
                                                >
                                                    <ATableSectionHeader>
                                                        <ATableCell className="pl-4 font-semibold">
                                                            {skillGroup.name}
                                                        </ATableCell>
                                                        <ATableCell className="text-center">
                                                            {toPercentage(
                                                                skillGroup
                                                                    .aggregates
                                                                    .okCount,
                                                                skillGroup
                                                                    .aggregates
                                                                    .skillsCount,
                                                            )}
                                                            %
                                                        </ATableCell>
                                                        <ATableCell className="text-muted-foreground">
                                                            {
                                                                skillGroup
                                                                    .aggregates
                                                                    .okCount
                                                            }{" "}
                                                            of{" "}
                                                            {
                                                                skillGroup
                                                                    .aggregates
                                                                    .skillsCount
                                                            }
                                                        </ATableCell>
                                                        <ATableCell></ATableCell>
                                                        <ATableCell className="p-0">
                                                            <ATableTrigger />
                                                        </ATableCell>
                                                    </ATableSectionHeader>
                                                    <ATableSectionContent>
                                                        {skillGroup.skills.map(
                                                            (skill) => (
                                                                <ATableRow
                                                                    key={
                                                                        skill.skillId
                                                                    }
                                                                >
                                                                    <ATableCell className="pl-8">
                                                                        {
                                                                            skill.name
                                                                        }
                                                                    </ATableCell>
                                                                    {match(
                                                                        skill.check,
                                                                    )
                                                                        .with(
                                                                            {
                                                                                competent: true,
                                                                                expired: false,
                                                                            },
                                                                            (
                                                                                check,
                                                                            ) => (
                                                                                <>
                                                                                    <ATableCell className="flex justify-center items-center">
                                                                                        <CheckIcon className="h-4 w-4 text-green-500" />
                                                                                    </ATableCell>
                                                                                    <ATableCell className="text-muted-foreground">
                                                                                        by{" "}
                                                                                        {
                                                                                            teamMembersMap.get(
                                                                                                check.assessorId,
                                                                                            )
                                                                                                ?.person
                                                                                                .name
                                                                                        }
                                                                                    </ATableCell>
                                                                                    <ATableCell className="text-muted-foreground">
                                                                                        expires{" "}
                                                                                        {formatDate(
                                                                                            addYears(
                                                                                                check.date,
                                                                                                1,
                                                                                            ),
                                                                                            "d MMM yyyy",
                                                                                        )}
                                                                                    </ATableCell>
                                                                                </>
                                                                            ),
                                                                        )
                                                                        .with(
                                                                            {
                                                                                competent: true,
                                                                                expired: true,
                                                                            },
                                                                            (
                                                                                check,
                                                                            ) => (
                                                                                <>
                                                                                    <ATableCell className="flex justify-center items-center">
                                                                                        <ClockAlertIcon className="h-4 w-4 text-orange-300" />
                                                                                    </ATableCell>
                                                                                    <ATableCell className="text-muted-foreground">
                                                                                        by{" "}
                                                                                        {
                                                                                            teamMembersMap.get(
                                                                                                check.assessorId,
                                                                                            )
                                                                                                ?.person
                                                                                                .name
                                                                                        }
                                                                                    </ATableCell>
                                                                                    <ATableCell className="text-muted-foreground">
                                                                                        expired{" "}
                                                                                        {formatDate(
                                                                                            addYears(
                                                                                                check.date,
                                                                                                1,
                                                                                            ),
                                                                                            "d MMM yyyy",
                                                                                        )}
                                                                                    </ATableCell>
                                                                                </>
                                                                            ),
                                                                        )
                                                                        .with(
                                                                            {
                                                                                result: "NotCompetent",
                                                                            },
                                                                            (
                                                                                check,
                                                                            ) => (
                                                                                <>
                                                                                    <ATableCell className="flex justify-center items-center">
                                                                                        <XIcon className="h-4 w-4 text-red-500" />
                                                                                    </ATableCell>
                                                                                    <ATableCell className="text-muted-foreground">
                                                                                        by{" "}
                                                                                        {
                                                                                            teamMembersMap.get(
                                                                                                check.assessorId,
                                                                                            )
                                                                                                ?.person
                                                                                                .name
                                                                                        }
                                                                                    </ATableCell>
                                                                                </>
                                                                            ),
                                                                        )
                                                                        .otherwise(
                                                                            () =>
                                                                                null,
                                                                        )}
                                                                    {/* <ATableCell className="flex justify-center">
                                                <div>{skill.check?.ok ? <CheckIcon className="h-4 w-4 text-green-500" /> : <XIcon className="h-4 w-4 text-red-500" />}</div>
                                            </ATableCell>
                                            <ATableCell>
                                                {match(skill.check)
                                                    .with(undefined, () => CompetenceLevelTerms['NotAssessed'])
                                                    .with({ competent: false }, (check) => CompetenceLevelTerms[check.result])
                                                    .with({ competent: true, expired: true }, (check) => `expired by ${formatDistance(new Date(check.date), subDays(new Date(), 365))}`)
                                                    .with({ competent: true, expired: false }, () => <></>)
                                                    .exhaustive()
                                                }
                                            </ATableCell> */}
                                                                </ATableRow>
                                                            ),
                                                        )}
                                                    </ATableSectionContent>
                                                </ATableSection>
                                            );
                                        },
                                    )}
                                </Fragment>
                            ))}
                            <ATableRow>
                                <ATableCell className="font-bold text-right">
                                    Total
                                </ATableCell>
                                <ATableCell className="text-center">
                                    {toPercentage(
                                        aggregates.okCount,
                                        aggregates.skillsCount,
                                    )}
                                    %
                                </ATableCell>
                                <ATableCell className="text-muted-foreground">
                                    {aggregates.okCount} of{" "}
                                    {aggregates.skillsCount}
                                </ATableCell>
                            </ATableRow>
                        </ATableBody>
                    </ATable>
                </CardContent>
            </Card>
        </>
    );
}

function toPercentage(value: number, total: number) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
}
