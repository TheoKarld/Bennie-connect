/**
 * Shared branded HTML email templates for Bennie Connect.
 *
 * Everything is table-based with inline CSS so it renders consistently across
 * email clients (Gmail, Outlook, Apple Mail, etc.). Brand palette:
 *   primary  #135D39 (deep green)
 *   accent   #E7A13C (harvest gold)
 *   bg       #FAF8F5 (warm off-white)
 *   ink      #1A2421 (near-black text)
 */

const BRAND = {
  primary: '#135D39',
  accent: '#E7A13C',
  bg: '#FAF8F5',
  ink: '#1A2421',
  muted: '#6B7772',
  card: '#FFFFFF',
  border: '#E8E2D9',
};

const MISSION =
  'Bennie Connect helps Nigerian farmers build lasting wealth together through cooperative savings, shared equity, and fair access to finance, equipment and markets.';
const VALUES = 'Community · Transparency · Growth · Trust';

/**
 * A primary call-to-action button rendered as a bulletproof table so it shows
 * up (and stays tappable) even in clients that strip padding on <a>.
 */
function ctaButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 4px;">
      <tr>
        <td align="center" bgcolor="${BRAND.primary}" style="border-radius: 8px;">
          <a href="${href}" target="_blank"
             style="display: inline-block; padding: 14px 30px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

/**
 * Wraps body content in the shared header + footer chrome.
 */
export function baseLayout(appUrl: string, innerHtml: string): string {
  return `
  <div style="margin: 0; padding: 0; background-color: ${BRAND.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND.bg}; padding: 24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
            <!-- Header -->
            <tr>
              <td style="padding: 8px 8px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align: middle;">
                      <img src="${appUrl}/ben_logo.png" alt="Bennie Connect" height="40" style="display: block; height: 40px; border: 0;" />
                    </td>
                    <td style="vertical-align: middle; padding-left: 12px; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: bold; color: ${BRAND.primary};">
                      Bennie&nbsp;Connect
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Card -->
            <tr>
              <td style="background-color: ${BRAND.card}; border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 32px; font-family: Arial, Helvetica, sans-serif; color: ${BRAND.ink};">
                ${innerHtml}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding: 24px 12px 8px; font-family: Arial, Helvetica, sans-serif;">
                <p style="margin: 0 0 10px; font-size: 13px; line-height: 1.6; color: ${BRAND.muted};">
                  ${MISSION}
                </p>
                <p style="margin: 0 0 12px; font-size: 13px; font-weight: bold; color: ${BRAND.primary}; letter-spacing: 0.3px;">
                  ${VALUES}
                </p>
                <p style="margin: 0; font-size: 12px; color: ${BRAND.muted};">
                  &copy; ${new Date().getFullYear()} Bennie Connect. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

export function welcomeTemplate(appUrl: string, firstName?: string): string {
  const name = firstName || 'there';
  const dashboardUrl = `${appUrl}/app`;
  const benefit = (title: string, body: string) => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.border};">
        <span style="font-size: 15px; font-weight: bold; color: ${BRAND.primary};">${title}</span><br/>
        <span style="font-size: 14px; line-height: 1.5; color: ${BRAND.ink};">${body}</span>
      </td>
    </tr>`;

  const inner = `
    <h1 style="margin: 0 0 8px; font-size: 24px; color: ${BRAND.primary};">Welcome, ${name}! 🌱</h1>
    <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.6; color: ${BRAND.ink};">
      Your Bennie Connect cooperative account is ready. You have just joined a
      community of Nigerian farmers building lasting wealth together. Here is
      everything waiting for you:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 22px;">
      ${benefit('High-yield savings', 'Grow your money with Flex, Target and Harvest savings — earning up to ~12.5% APY.')}
      ${benefit('Cooperative shares & dividends', 'Buy equity in the cooperative and share in the profits every cycle.')}
      ${benefit('Adashe / Esusu circles', 'Join trusted rotating-savings circles and get your payout when your turn comes.')}
      ${benefit('Equipment booking with GPS', 'Book tractors and machinery on demand and track them to your farm.')}
      ${benefit('Agri-services & inputs marketplaces', 'Hire agronomists and buy quality seeds, fertiliser and tools at fair prices.')}
      ${benefit('Agent commission network', 'Earn commissions by bringing more farmers into the cooperative.')}
    </table>
    ${ctaButton(dashboardUrl, 'Go to your dashboard')}
    <p style="margin: 18px 0 0; font-size: 14px; color: ${BRAND.muted};">
      Happy farming,<br/>The Bennie Connect Team
    </p>`;

  return baseLayout(appUrl, inner);
}

export function passwordResetTemplate(
  appUrl: string,
  resetLink: string,
  firstName?: string,
): string {
  const name = firstName || 'there';
  const inner = `
    <h1 style="margin: 0 0 8px; font-size: 22px; color: ${BRAND.primary};">Reset your password</h1>
    <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.6; color: ${BRAND.ink};">
      Hi ${name}, we received a request to reset your Bennie Connect password.
      Click the button below to choose a new one.
    </p>
    ${ctaButton(resetLink, 'Reset my password')}
    <p style="margin: 18px 0 6px; font-size: 13px; color: ${BRAND.muted};">
      This link expires in <strong>1 hour</strong> and can be used only once.
    </p>
    <p style="margin: 0 0 18px; font-size: 13px; color: ${BRAND.muted};">
      If you did not request this, you can safely ignore this email — your
      password will stay unchanged.
    </p>
    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${BRAND.muted}; word-break: break-all;">
      If the button doesn't work, paste this link into your browser:<br/>
      <a href="${resetLink}" style="color: ${BRAND.primary};">${resetLink}</a>
    </p>`;

  return baseLayout(appUrl, inner);
}

export function verificationTemplate(
  appUrl: string,
  token: string,
  firstName?: string,
): string {
  const name = firstName || 'there';
  const inner = `
    <h1 style="margin: 0 0 8px; font-size: 22px; color: ${BRAND.primary};">Verify your email</h1>
    <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.6; color: ${BRAND.ink};">
      Hi ${name}, please confirm your email address by entering the code below
      in the app.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 18px;">
      <tr>
        <td style="background-color: ${BRAND.bg}; border: 1px dashed ${BRAND.accent}; border-radius: 10px; padding: 16px 28px; font-family: 'Courier New', monospace; font-size: 26px; font-weight: bold; letter-spacing: 6px; color: ${BRAND.primary};">
          ${token}
        </td>
      </tr>
    </table>
    <p style="margin: 0; font-size: 13px; color: ${BRAND.muted};">
      This code expires shortly. If you did not sign up for Bennie Connect, you
      can ignore this email.
    </p>`;

  return baseLayout(appUrl, inner);
}

export function passwordChangedTemplate(
  appUrl: string,
  firstName?: string,
): string {
  const name = firstName || 'there';
  const inner = `
    <h1 style="margin: 0 0 8px; font-size: 22px; color: ${BRAND.primary};">Your password was changed</h1>
    <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: ${BRAND.ink};">
      Hi ${name}, this is a confirmation that your Bennie Connect password was
      just changed. You can now sign in with your new password.
    </p>
    <p style="margin: 0; font-size: 13px; color: ${BRAND.muted};">
      If this wasn't you, please reset your password again immediately and
      contact our support team.
    </p>`;

  return baseLayout(appUrl, inner);
}
