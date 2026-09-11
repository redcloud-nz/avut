# Password Change on Account Profile Page

**Project:** avut
**Date:** 2026-06-16 00:00

## Idea

Add the ability for users to change their own password from their account profile page. This is a standard user account feature that improves self-service and reduces reliance on password reset flows. The form should require the current password for verification before accepting a new one.

## Notes

- UI lives on the user's account/profile settings page (not org admin)
- Auth is handled by better-auth — check if it exposes a `changePassword` method or equivalent
