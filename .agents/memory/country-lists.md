---
name: Country lists divergence
description: Multiple independent country allow-lists exist; changing signup countries does not auto-propagate to other flows.
---

# Country allow-lists are NOT unified

`ALLOWED_REGISTRATION_COUNTRIES` (shared/schema.ts) drives the signup country `<Select>` options (used by both personal and business signup, and by profile country edit). But several other flows keep their own divergent lists:

- `updateUserCountrySchema` (shared/schema.ts) — restricts the profile/old-user country update to a *smaller* set (BJ/TG/CI/BF/SN). Selecting a newer country in the profile dropdown can fail server validation here.
- `/api/user/country` route has an inline `allowedCountries` array (also the smaller 5-country set).
- `COLLECT_COUNTRIES` / `PAYOUT_COUNTRIES` — the 16-country operational set for payin/payout, separate again.
- Other inline `validCountries` arrays exist in routes.ts.

**Why:** registration eligibility, profile-edit eligibility, and operational payin/payout support are distinct concerns that were never consolidated.

**How to apply:** when adding/removing a country for *signup*, only `ALLOWED_REGISTRATION_COUNTRIES` + the two Zod enums in `client/src/pages/signup.tsx` + the `COUNTRY_NAMES` map in signup.tsx need updating. If the goal is to also let existing users switch to that country in their profile, you must additionally widen `updateUserCountrySchema` and the inline list in `/api/user/country`. Operational support requires the COLLECT/PAYOUT lists.

## Business signup country
Business signup stores the chosen country as BOTH `users.country` and `users.businessCountry` (set at `POST /api/auth/signup`). `getUserHomeCountry()` resolves business accounts as `businessCountry || country`.
