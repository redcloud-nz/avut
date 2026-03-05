/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { PersonData } from "./lib/schemas/person";
import type { Skill } from "@/lib/schemas/skill";
import type { SkillGroup } from "@/lib/schemas/skill-group";
import type { SkillPackage } from "@/lib/schemas/skill-package";
import type { TeamData } from "./lib/schemas/team";

export const about = {
    label: "About",
    href: "/about",
} as const;

export const auth = {
    acceptInvitation: (invitationId: string) =>
        ({
            label: "Accept Invitation",
            href: `/auth/accept-invitation/${invitationId}`,
        }) as const,
    forgotPassword: {
        label: "Forgot Password",
        href: "/auth/forgot-password",
    },
    resetPassword: (email: string) =>
        ({
            label: "Reset Password",
            href: `/auth/reset-password?e=${encodeURIComponent(email)}`,
        }) as const,
    signIn: ({
        email,
        redirect,
    }: { email?: string; redirect?: string } = {}) => {
        const parts = [];
        if (email) {
            parts.push(`e=${encodeURIComponent(email)}`);
        }
        if (redirect) {
            parts.push(`r=${encodeURIComponent(redirect)}`);
        }

        return {
            label: "Sign In",
            href:
                parts.length > 0
                    ? `/auth/sign-in?${parts.join("&")}`
                    : "/auth/sign-in",
        } as const;
    },
    signUp: ({ redirect }: { redirect?: string } = {}) =>
        ({
            label: "Sign Up",
            href: redirect
                ? `/auth/sign-up?r=${encodeURIComponent(redirect)}`
                : "/auth/sign-up",
        }) as const,
    verifyEmail: ({ email, redirect }: { email: string; redirect?: string }) =>
        ({
            label: "Verify Email",
            href: redirect
                ? `/auth/verify-email?e=${encodeURIComponent(email)}&r=${encodeURIComponent(redirect)}`
                : `/auth/verify-email?e=${encodeURIComponent(email)}`,
        }) as const,
} as const;

export const dashboard = {
    label: "Dashboard",
    href: "/dashboard",
} as const;

export const marketing = {
    index: { href: "/" },
    contact: {
        label: "Contact",
        href: "/contact",
    },
    faq: {
        label: "FAQ",
        href: "/#faq",
    },
    features: {
        label: "Features",
        href: "/#features",
    },
    pricing: {
        label: "Pricing",
        href: "/#pricing",
    },
    privacyPolicy: {
        label: "Privacy Policy",
        href: "/privacy-policy",
    },
    termsOfService: {
        label: "Terms of Service",
        href: "/terms-of-service",
    },
    testimonials: {
        label: "Testimonials",
        href: "/#testimonials",
    },
};

export const onboarding = {
    chooseOrganization: {
        label: "Choose Organization",
        href: "/onboarding/choose-organization",
    },
};

export const orgs = {
    create: {
        label: "Create Organization",
        href: "/orgs/--create",
    },
    select: {
        label: "Select Organization",
        href: "/orgs/--select",
    },
    selectAuto: {
        href: "/orgs/--select?auto",
    },
} as const;

type OrgPaths = {
    admin: ReturnType<typeof adminModule>;
    availability: ReturnType<typeof availabilityModule>;
    cards: ReturnType<typeof cardsModule>;
    checklists: ReturnType<typeof checklistsModule>;
    dashboard: { label: string; href: string };
    d4HPPE: ReturnType<typeof d4HPPEModule>;
    d4HViews: ReturnType<typeof d4HViewsModule>;
    dev: ReturnType<typeof devModule>;
    fog: ReturnType<typeof fogModule>;
    notes: ReturnType<typeof notesModule>;
    skills: ReturnType<typeof skillsModule>;
    skillPackageBuilder: ReturnType<typeof skillPackageBuilderModule>;
};

const orgPathCache = new Map<string, OrgPaths>();

export function org(orgSlug: string): OrgPaths {
    let paths = orgPathCache.get(orgSlug);
    if (!paths) {
        paths = {
            admin: adminModule(orgSlug),
            availability: availabilityModule(orgSlug),
            cards: cardsModule(orgSlug),
            checklists: checklistsModule(orgSlug),
            dashboard: { label: "Dashboard", href: `/orgs/${orgSlug}` },
            d4HPPE: d4HPPEModule(orgSlug),
            d4HViews: d4HViewsModule(orgSlug),
            dev: devModule(orgSlug),
            fog: fogModule(orgSlug),
            notes: notesModule(orgSlug),
            skills: skillsModule(orgSlug),
            skillPackageBuilder: skillPackageBuilderModule(orgSlug),
        } satisfies OrgPaths;
        orgPathCache.set(orgSlug, paths);
    }

    return paths;
}

export const personal = {
    index: {
        label: "Personal",
        href: "/personal",
    },

    dashboard: {
        label: "Dashboard",
        href: "/personal",
    },

    d4hAccessToken: (tokenId: string) =>
        ({
            href: `/personal/d4h-access-tokens/${tokenId}`,
        }) as const,
    d4hAccessTokens: {
        label: "D4H Access Tokens",
        href: `/personal/d4h-access-tokens`,
        create: {
            label: "Add Access Token",
            href: `/personal/d4h-access-tokens/--create`,
        },
    },
    invitation: (invitationId: string) =>
        ({
            href: `/personal/invitations/${invitationId}`,
        }) as const,
    invitations: {
        label: "Invitations",
        href: `/personal/invitations`,
    },
    settings: {
        label: "Settings",
        href: `/personal/settings`,
    },
    whoami: {
        label: "Who Am I",
        href: `/personal/whoami`,
    },
    profile: {
        label: "Profile",
        href: `/personal/profile`,
    },
} as const;

export function pub(slug: string) {
    const base = `/pub/orgs/${slug}` as const;

    return {
        forms: {
            index: {
                label: "Forms",
                href: `${base}/forms`,
            },

            ppe: {
                label: "PPE",
                href: `${base}/forms/ppe`,

                borrow: {
                    label: "Borrow",
                    href: `${base}/forms/ppe/borrow`,
                },

                inspect: {
                    label: "Inspect",
                    href: `${base}/forms/ppe/inspect`,
                },

                issue: {
                    label: "Issue",
                    href: `${base}/forms/ppe/issue`,
                },

                return: {
                    label: "Return",
                    href: `${base}/forms/ppe/return`,
                },
            },
        },
    } as const;
}

// Modules

function adminModule(org_slug: string) {
    const base = `/orgs/${org_slug}/admin` as const;

    return {
        index: {
            label: "Admin",
            href: base,
        },

        d4hAccessToken: (tokenId: string) =>
            ({
                href: `${base}/d4h-access-tokens/${tokenId}`,
            }) as const,

        d4hAccessTokens: {
            label: "D4H Access Tokens",
            href: `${base}/d4h-access-tokens`,

            create: {
                label: "Add Access Token",
                href: `${base}/d4h-access-tokens/--create`,
            },
        },

        invitations: {
            label: "Invitations",
            href: `${base}/invitations`,
        },

        organization: {
            label: "Organization",
            href: `${base}/organization`,

            update: {
                label: "Update",
                href: `${base}/organization/--update`,
            },

            settings: {
                label: "Settings",
                href: `${base}/organization/settings`,
            },
        },

        person: (personOrPersonId: PersonData | string) => {
            const personId =
                typeof personOrPersonId === "string"
                    ? personOrPersonId
                    : personOrPersonId.id;
            const personBase = `${base}/personnel/${personId}` as const;
            return {
                index: {
                    href: personBase,
                    label:
                        typeof personOrPersonId === "string"
                            ? (undefined as never)
                            : personOrPersonId.name,
                },

                history: {
                    label: "History",
                    href: `${personBase}/history`,
                },

                teamMembership: (teamId: string) =>
                    ({
                        href: `${personBase}/team-memberships/${teamId}`,

                        update: {
                            label: "Update",
                            href: `${personBase}/team-memberships/${teamId}/--update`,
                        },
                    }) as const,

                teamMemberships: {
                    label: "Team Memberships",
                    href: `${personBase}/team-memberships`,

                    create: {
                        label: "Add Team Membership",
                        href: `${personBase}/team-memberships/--create`,
                    },
                },

                update: {
                    label: "Update",
                    href: `${personBase}/--update`,
                },
            } as const;
        },
        personnel: {
            label: "Personnel",
            href: `${base}/personnel`,

            import: {
                label: "Import Personnel",
                href: `${base}/personnel/--import`,
            },
        },
        profile: {
            href: `${base}/profile`,
            label: "Organisation",
        },

        team: (teamOrTeamId: TeamData | string) => {
            const teamId =
                typeof teamOrTeamId === "string"
                    ? teamOrTeamId
                    : teamOrTeamId.id;
            const teamBase = `${base}/teams/${teamId}` as const;
            return {
                index: {
                    href: teamBase,
                    label:
                        typeof teamOrTeamId === "string"
                            ? (undefined as never)
                            : teamOrTeamId.name,
                },

                history: {
                    label: "History",
                    href: `${teamBase}/history`,
                },

                member: (personId: string) =>
                    ({
                        href: `${teamBase}/members/${personId}`,

                        update: {
                            label: "Update",
                            href: `${teamBase}/members/${personId}/--update`,
                        },
                    }) as const,
                members: {
                    label: "Members",
                    href: `${teamBase}/members`,

                    create: {
                        label: "Add Member",
                        href: `${teamBase}/members/--create`,
                    },
                },
                update: {
                    label: "Update",
                    href: `${teamBase}/--update`,
                },
            } as const;
        },
        teams: {
            label: "Teams",
            href: `${base}/teams`,
        },
        user: (userId: string) =>
            ({
                href: `${base}/users/${userId}`,
                update: {
                    label: "Update User",
                    href: `${base}/users/${userId}/--update`,
                },
            }) as const,
        users: {
            label: "Users",
            href: `${base}/users`,
        },
    } as const;
}

function availabilityModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/availability` as const;

    return {
        label: "Availability",
        href: base,
    } as const;
}

function cardsModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/cards` as const;

    return {
        label: "Reference Cards",
        href: base,
    } as const;
}

function checklistsModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/checklists` as const;

    return {
        label: "Checklists",
        href: base,
    } as const;
}

function d4HPPEModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/d4h-ppe` as const;

    return {
        index: {
            label: "D4H PPE",
            href: base,
        },
    } as const;
}

function d4HViewsModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/d4h-views` as const;

    return {
        index: {
            label: "D4H Views",
            href: base,
        },
        activities: {
            label: "Activities",
            href: `${base}/activities`,
            bgColor: "bg-teal-400",
        },
        calendar: {
            label: "Calendar",
            href: `${base}/calendar`,
            bgColor: "bg-yellow-400",
        },

        equipment: {
            index: {
                label: "Equipment",
                href: `${base}/equipment`,
            },

            brand: (brandId: number) =>
                ({
                    href: `${base}/equipment/brands/${brandId}`,
                }) as const,
            brands: {
                label: "Brands",
                href: `${base}/equipment/brands`,
            },

            categories: {
                label: "Categories",
                href: `${base}/equipment/categories`,
            },
            category: (categoryId: number) =>
                ({
                    href: `${base}/equipment/categories/${categoryId}`,

                    kind: (kindId: number) =>
                        ({
                            href: `${base}/equipment/categories/${categoryId}/kinds/${kindId}`,
                        }) as const,
                }) as const,

            item: (itemId: number) =>
                ({
                    href: `${base}/equipment/items/${itemId}`,
                }) as const,
            items: {
                href: `${base}/equipment/items`,
                label: "Items",
            },
        },

        member: (teamId: number, memberId: number) =>
            ({
                href: `${base}/members/${teamId}/${memberId}`,
            }) as const,
        members: {
            label: "Members",
            href: `${base}/members`,
        },

        personnel: {
            label: "Personnel",
            href: `${base}/personnel`,
            bgColor: "bg-blue-400",
        },
        teams: {
            label: "Teams",
            href: `${base}/teams`,
            bgColor: "bg-green-400",
        },
    } as const;
}

function devModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/dev` as const;

    return {
        label: "Dev",
        href: base,
        tableLayout: {
            label: "Table Layout",
            href: `${base}/table-layout`,
        },
    } as const;
}

function fogModule(orgSlug: string) {
    return {
        label: "Field Operations Guide",
        href: `/orgs/${orgSlug}/fog`,
    } as const;
}

function notesModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/notes` as const;
    return {
        index: {
            label: "Notes",
            href: base,
        },

        create: {
            label: "New Note",
            href: `${base}/--create`,
        },

        note: (noteId: string) =>
            ({
                labelled: (noteTitle: string) => ({
                    label: noteTitle,
                    href: `${base}/${noteId}`,
                }),
                href: `${base}/${noteId}`,
                history: {
                    label: "History",
                    href: `${base}/${noteId}/history`,
                },
                update: {
                    label: "Update",
                    href: `${base}/${noteId}/--update`,
                },
            }) as const,
    } as const;
}

function personalModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/personal` as const;
}

function skillsModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/skills` as const;
    return {
        index: {
            label: "Skills",
            href: base,
        },

        catalogue: {
            label: "Catalogue",
            href: `${base}/catalogue`,
        },
        cataloguePackage: (packageId: string) =>
            ({
                href: `${base}/catalogue/${packageId}`,
            }) as const,

        checks: {
            label: "Checks",
            href: `${base}/checks`,
            create: {
                label: "Record Check",
                href: `${base}/checks/--create`,
            },
        },
        reports: {
            label: "Reports",
            href: `${base}/reports`,
            individual: {
                href: `${base}/reports/individual`,
                label: "Individual",
            },
            teamSkills: {
                href: `${base}/reports/team-skills`,
                label: "Team Skills",
            },
            teamMembers: {
                href: `${base}/reports/team-members`,
                label: "Team Members",
            },
        },
        session: (sessionId: string) => {
            return {
                href: `${base}/sessions/${sessionId}`,

                record: {
                    href: `${base}/sessions/${sessionId}/record`,
                    label: "Recorder",
                },
                review: {
                    href: `${base}/sessions/${sessionId}/review`,
                    label: "Review",
                },
                update: {
                    label: "Update",
                    href: `${base}/sessions/${sessionId}/--update`,
                },
            } as const;
        },
        sessions: {
            label: "Sessions",
            href: `${base}/sessions`,
            create: {
                label: "Create",
                href: `${base}/sessions/--create`,
            },
        },
    } as const;
}

function skillPackageBuilderModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/skill-package-builder` as const;

    return {
        index: {
            label: "Skill Package Builder",
            href: base,
        },

        skillPackage: (packageOrPackageId: SkillPackage | string) => {
            const packageId =
                typeof packageOrPackageId === "string"
                    ? packageOrPackageId
                    : packageOrPackageId.id;

            const packageBase = `${base}/packages/${packageId}` as const;

            return {
                index: {
                    href: packageBase,
                    label:
                        typeof packageOrPackageId === "string"
                            ? (undefined as never)
                            : packageOrPackageId.name,
                },

                update: {
                    href: `${packageBase}/--update`,
                    label: "Update",
                },

                group: (groupOrGroupId: SkillGroup | string) => {
                    const groupId =
                        typeof groupOrGroupId === "string"
                            ? groupOrGroupId
                            : groupOrGroupId.id;

                    return {
                        href: `${packageBase}/groups/${groupId}`,
                        label:
                            typeof groupOrGroupId === "string"
                                ? (undefined as never)
                                : groupOrGroupId.name,

                        update: {
                            label: "Update",
                            href: `${packageBase}/groups/${groupId}/--update`,
                        },
                    } as const;
                },
                groups: {
                    label: "Groups",
                    href: `${packageBase}/groups`,
                },

                history: {
                    label: "History",
                    href: `${packageBase}/history`,
                },

                skill: (skillOrSkillId: Skill | string) => {
                    const skillId =
                        typeof skillOrSkillId === "string"
                            ? skillOrSkillId
                            : skillOrSkillId.id;

                    return {
                        href: `${packageBase}/skills/${skillId}`,
                        label:
                            typeof skillOrSkillId === "string"
                                ? (undefined as never)
                                : skillOrSkillId.name,
                        update: {
                            label: "Update",
                            href: `${packageBase}/skills/${skillId}/--update`,
                        },
                    } as const;
                },
                skills: {
                    label: "Skills",
                },
            } as const;
        },
        skillPackages: {
            import: {
                label: "Import Skill Package",
                href: `${base}/packages/--import`,
            },
        } as const,
    };
}

const docsBase = "https://github.com/redcloud-nz/rtplus/wiki";

export const documentation = {
    index: `${docsBase}`,
    glossary: `${docsBase}/glossary`,
    competencies: {
        label: "Documentation",
        href: `${docsBase}/Competencies`,
    },
    personnel: `${docsBase}/personnel`,
    skills: `${docsBase}/skills`,
    skillGroups: `${docsBase}/skill-groups`,
    skillPackages: `${docsBase}/skill-packages`,
    teams: `${docsBase}/teams`,
    unified: `${docsBase}/unified`,
    account: `${docsBase}/account`,
};
