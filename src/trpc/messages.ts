/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export const Messages = {
    noteNotFound: (noteId: string) => `Note(${noteId}) not found.`,

    personNotAUser: (personId: string) =>
        `Person(${personId}) is not configured as a user.`,

    personNotFound: (personId: string) => `Person(${personId}) not found.`,

    sessionNotFound: (sessionId: string) =>
        `SkillCheckSession(${sessionId}) not found.`,

    skillPackageNotFound: (skillPackageId: string) =>
        `SkillPackage(${skillPackageId}) not found.`,

    skillPackageSubscriptionNotFound: (subscriptionId: string) =>
        `Subscription for SkillPackage(${subscriptionId}) not found.`,

    skillNotFound: (skillId: string) => `Skill(${skillId}) not found.`,

    skillGroupNotFound: (skillGroupId: string) =>
        `SkillGroup(${skillGroupId}) not found.`,

    teamForbidden: (teamId: string) =>
        `You do not have access to team(${teamId}).`,

    teamNotFound: (teamId: string) => `Team(${teamId}) not found.`,

    teamMembershipNotFound: (personId: string, teamId: string) =>
        `Team membership not found for Person(${personId}) and Team(${teamId}).`,
} as const;
