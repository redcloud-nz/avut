/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export const Messages = {
    alreadySubscribedToPackage: (packageName: string) =>
        `Your organisation is already subscribed to the skill package "${packageName}".`,

    d4HAccessTokenNotFound: (tokenId: string) => `D4H Access Token(id=${tokenId}) not found.`,

    d4HAccessTokenRejected: (status: number) =>
        `D4H rejected the access token (HTTP ${status}). Check the token and server, then try again.`,

    d4HUnavailable: (status: number) =>
        `Couldn't check the access token: D4H returned an error (HTTP ${status}). Try again later.`,

    formInstanceNotFound: (formInstanceId: string) =>
        `FormInstance(id=${formInstanceId}) not found.`,

    i3TemplateNotFound: (templateId: string) => `I3Template(id=${templateId}) not found.`,

    i3TemplateVariantNotFound: (variantId: string) =>
        `I3TemplateVariant(id=${variantId}) not found.`,

    ineligibleAssessors: (personIds: string[]) =>
        `Cannot add ${personIds.map((id) => `Person(id=${id})`).join(", ")} as an assessor: an assessor must be an active person linked to a user who can record skill checks.`,

    noLinkedPersonRecord: () => `You must have a linked person record to perform this action.`,

    noteNotFound: (noteId: string) => `Note(id=${noteId}) not found.`,

    notCheckAssessor: (skillCheckId: string) =>
        `You are not the assessor who recorded SkillCheck(id=${skillCheckId}).`,

    organizationNotFound: (organizationId: string) =>
        `Organization(id=${organizationId}) not found.`,

    personalD4HAccessTokenExists: () =>
        `You already have a personal D4H access token for this organisation. Remove it before adding a new one.`,

    personalD4HAccessTokenNotFound: () =>
        `You don't have a personal D4H access token for this organisation.`,

    personNotAUser: (personId: string) => `Person(id=${personId}) is not configured as a user.`,

    personNotFound: (personId: string) => `Person(id=${personId}) not found.`,

    sessionCheckNotAllowed: (sessionId: string) =>
        `Cannot create a check in SkillCheckSession(id=${sessionId}) here: record session checks through the session.`,

    skillCheckNotFound: (skillCheckId: string) => `SkillCheck(id=${skillCheckId}) not found.`,

    skillCheckSessionNotFound: (sessionId: string) =>
        `SkillCheckSession(id=${sessionId}) not found.`,

    skillPackageNotFound: (skillPackageId: string) =>
        `SkillPackage(id=${skillPackageId}) not found.`,

    skillPackageSubscriptionNotFound: (subscriptionId: string) =>
        `Subscription for SkillPackage(id=${subscriptionId}) not found.`,

    skillGroupNotFound: (skillGroupId: string) => `SkillGroup(id=${skillGroupId}) not found.`,

    skillNotFound: (skillId: string) => `Skill(id=${skillId}) not found.`,

    teamForbidden: (teamId: string) => `You do not have access to Team(id=${teamId}).`,

    teamNotFound: (teamId: string) => `Team(id=${teamId}) not found.`,

    teamMembershipNotFound: ({ personId, teamId }: { personId: string; teamId: string }) =>
        `Team membership not found for Person(id=${personId}) and Team(id=${teamId}).`,

    teamMembershipNotFoundById: (teamMembershipId: string) =>
        `TeamMembership(id=${teamMembershipId}) not found.`,

    userNotFound: (userId: string) => `User(id=${userId}) not found.`,
} as const;
