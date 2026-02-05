# Modern Login Page with OTP Support

## Overview

Implementation of a new modern login page template that supports traditional password login plus OTP authentication via email and WhatsApp. The classic template remains the default. Template selection is controlled by Namespace configuration (`loginPageVariant`), and the page supports internationalization (pt-BR/en) based on Namespace locale determined at runtime. The page uses Tailwind CSS during development with inline CSS generation integrated into the build process.

## Architecture

### Configuration Priority

All configuration values follow the priority: **Namespace → env vars → defaults**

- `loginPageVariant`: `MetaObject.Namespace.loginPageVariant` → `process.env.LOGIN_PAGE_VARIANT` → default `'classic'`
- `emailEnabled`: `MetaObject.Namespace.otpConfig?.emailTemplateId != null` → `process.env.OTP_EMAIL_ENABLED === 'true'` → default `false`
- `whatsappEnabled`: `MetaObject.Namespace.otpConfig?.whatsapp != null` → `process.env.OTP_WHATSAPP_ENABLED === 'true'` → default `false`
- `locale`: `MetaObject.Namespace.locale` → `process.env.DEFAULT_LOCALE` → default `'pt-BR'`

### Template Selection

The `view.ts` route handler reads `loginPageVariant` at runtime and selects the appropriate template:
- If `loginPageVariant === 'modern'`: uses `login/modern.hbs`
- Otherwise: uses `login/login.hbs` (classic, default)

### Build Process

1. `yarn build:login-css` runs Tailwind CSS compilation
2. CSS is generated in `src/private/templates/login/modern-tailwind-output.css`
3. During template rendering, CSS is read and injected inline into the template
4. `yarn build` includes CSS generation before babel compilation
5. Dockerfile copies `src/private` folder (templates with inline CSS already included)

### Features

#### Traditional Login
- Username/email and password authentication
- Password reset flow
- Geolocation tracking
- Fingerprint collection (if enabled)
- Browser compatibility check

#### OTP via Email ("Receba seu código")
- Email input field
- OTP request via `/api/auth/request-otp`
- OTP verification via `/api/auth/verify-otp`
- Only visible if `emailEnabled === true`

#### OTP via WhatsApp ("Login rápido")
- Phone number input (E.164 format)
- OTP request via `/api/auth/request-otp`
- OTP verification via `/api/auth/verify-otp`
- Only visible if `whatsappEnabled === true`

### Internationalization

Translations are provided for:
- **pt-BR** (default): Portuguese (Brazil)
- **en**: English

Locale is determined at runtime based on Namespace configuration or environment variable.

### UI/UX

- Modern card-based layout
- Responsive design (mobile-first)
- Gradient buttons for OTP methods (green for WhatsApp, blue for email)
- Smooth transitions between states
- Loading indicators
- Error message display
- Success confirmations
- Icons: Lucide email SVG inline, WhatsApp SVG inline

## Implementation Details

### Files Created

1. `src/private/templates/login/modern.hbs` - Modern login template
2. `src/private/templates/login/modern.js` - Vanilla JavaScript for modern login
3. `src/private/templates/login/modern-tailwind-input.css` - Tailwind source file
4. `tailwind.config.js` - Tailwind configuration
5. `planning-bank/2024-12/modern-login-page/PLANNING.md` - This file
6. `planning-bank/2024-12/modern-login-page/TASK.md` - Task breakdown

### Files Modified

1. `src/imports/model/Namespace/index.ts` - Added `loginPageVariant` field
2. `src/server/routes/rest/view/view.ts` - Template selection, i18n, configuration priority
3. `package.json` - Added Tailwind dependency and `build:login-css` script
4. `README.md` - Documented new environment variables

### Routes Added

- `GET /login-modern.js` - Serves the modern login JavaScript file

## Testing Checklist

- [ ] Traditional login (username/password)
- [ ] Password reset flow
- [ ] OTP via email (request and verify)
- [ ] OTP via WhatsApp (request and verify)
- [ ] Geolocation tracking
- [ ] Fingerprint collection
- [ ] Browser compatibility check
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Internationalization (pt-BR and en)
- [ ] Configuration priority (Namespace vs env vars)
- [ ] OTP enabled/disabled combinations
- [ ] Template selection (classic vs modern)

## Notes

- The classic login page (`login.hbs`) remains the default
- All OTP functionality requires proper configuration in Namespace or environment variables
- CSS is generated during build and injected at runtime
- The modern template uses vanilla JavaScript (no jQuery dependency)
- All existing features from the classic page are preserved in the modern page

