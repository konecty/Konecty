# Modern Login Page - Task Breakdown

## Completed Tasks

- [x] Add `loginPageVariant` field to Namespace schema
- [x] Set up Tailwind CSS configuration and build process
- [x] Create `modern.hbs` template with HTML structure and responsive layout
- [x] Create `modern.js` with vanilla JavaScript for all login flows
- [x] Add i18n translations (pt-BR and en) and integrate with view.ts
- [x] Update view.ts to select template based on loginPageVariant and OTP configuration
- [x] Implement configuration priority (Namespace → env vars → defaults)
- [x] Add route for `/login-modern.js`
- [x] Document environment variables in README.md
- [x] Create planning documentation

## Pending Tasks

- [ ] Test all login methods (password, email OTP, WhatsApp OTP)
- [ ] Test reset password flow
- [ ] Test responsive design
- [ ] Test i18n switching (runtime)
- [ ] Test with OTP enabled/disabled combinations
- [ ] Test configuration priority (Namespace vs env vars)
- [ ] Verify build process generates CSS correctly
- [ ] Verify Docker build includes CSS in templates

## Implementation Notes

### Configuration Priority

All configuration follows the priority: **Namespace → env vars → defaults**

- `loginPageVariant`: Namespace → `LOGIN_PAGE_VARIANT` → `'classic'`
- `emailEnabled`: Namespace `otpConfig.emailTemplateId` → `OTP_EMAIL_ENABLED` → `false`
- `whatsappEnabled`: Namespace `otpConfig.whatsapp` → `OTP_WHATSAPP_ENABLED` → `false`
- `locale`: Namespace `locale` → `DEFAULT_LOCALE` → `'pt-BR'`

### Build Process

1. Run `yarn build:login-css` to generate CSS from Tailwind
2. CSS is written to `src/private/templates/login/modern-tailwind-output.css`
3. During template rendering, CSS is read and injected inline
4. `yarn build` runs CSS generation before babel compilation

### Template Selection

- Runtime check of `loginPageVariant` determines which template to use
- Default is `'classic'` (existing `login.hbs`)
- Set `loginPageVariant: 'modern'` in Namespace or `LOGIN_PAGE_VARIANT=modern` to use new template

