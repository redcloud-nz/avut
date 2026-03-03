/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export const Messages = {
    alreadySubscribedToPackage: (packageName: string) =>
        `Your organization is already subscribed to the skill package "${packageName}".`,

    d4HAccessTokenNotFound: (tokenId: string) =>
        `D4H Access Token(id=${tokenId}) not found.`,

    noteNotFound: (noteId: string) => `Note(id=${noteId}) not found.`,

    organizationNotFound: (organizationId: string) =>
        `Organization(id=${organizationId}) not found.`,

    personNotAUser: (personId: string) =>
        `Person(id=${personId}) is not configured as a user.`,

    personNotFound: (personId: string) => `Person(id=${personId}) not found.`,

    sessionNotFound: (sessionId: string) =>
        `SkillCheckSession(${sessionId}) not found.`,

    skillPackageNotFound: (skillPackageId: string) =>
        `SkillPackage(${skillPackageId}) not found.`,

    skillPackageSubscriptionNotFound: (subscriptionId: string) =>
        `Subscription for SkillPackage(id=${subscriptionId}) not found.`,

    skillGroupNotFound: (skillGroupId: string) =>
        `SkillGroup(${skillGroupId}) not found.`,

    skillNotFound: (skillId: string) => `Skill(id=${skillId}) not found.`,

    teamForbidden: (teamId: string) =>
        `You do not have access to team(${teamId}).`,

    teamNotFound: (teamId: string) => `Team(id=${teamId}) not found.`,

    teamMembershipNotFound: ({
        personId,
        teamId,
    }: {
        personId: string;
        teamId: string;
    }) =>
        `Team membership not found for Person(id=${personId}) and Team(id=${teamId}).`,
} as const;
