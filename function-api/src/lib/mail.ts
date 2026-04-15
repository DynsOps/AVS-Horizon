import { assertMailEnv, env } from './env';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

const buildLoginSectionHtml = (): string => {
  if (!env.mailLoginUrl) return '';

  return `
    <div style="margin-top:24px;">
      <a href="${env.mailLoginUrl}" style="display:inline-block;padding:12px 18px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">
        Sign in to AVS Horizon
      </a>
      <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
        If the button does not work, use this link:<br />
        <a href="${env.mailLoginUrl}" style="color:#1d4ed8;text-decoration:none;">${env.mailLoginUrl}</a>
      </p>
    </div>
  `;
};

const buildWelcomeHeaderHtml = (): string => {
  if (env.mailLogoUrl) {
    return `
      <div style="padding:28px 32px;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#ffffff;">
        <img src="${env.mailLogoUrl}" alt="AVS Horizon" style="display:block;max-width:220px;width:100%;height:auto;margin:0 0 14px;" />
        <h1 style="margin:0;font-size:28px;line-height:1.2;">Welcome to AVS Horizon</h1>
      </div>
    `;
  }

  return `
    <div style="padding:28px 32px;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#ffffff;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">AVS Horizon</p>
      <h1 style="margin:0;font-size:28px;line-height:1.2;">Welcome to AVS Horizon</h1>
    </div>
  `;
};

const buildWelcomeEmailHtml = (params: { displayName: string; email: string; temporaryPassword: string }): string => `
  <div style="background:#f3f6fb;padding:32px 16px;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:20px;overflow:hidden;">
      ${buildWelcomeHeaderHtml()}
      <div style="padding:32px;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hello ${params.displayName || params.email},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
          Your AVS Horizon account has been created successfully. Your first sign-in password is shown below.
        </p>
        <div style="margin:24px 0;padding:20px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:16px;">
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#1d4ed8;">Sign-in details</p>
          <p style="margin:0 0 6px;font-size:14px;"><strong>Email:</strong> ${params.email}</p>
          <p style="margin:0;font-size:16px;"><strong>Password:</strong> <span style="font-family:Consolas,monospace;">${params.temporaryPassword}</span></p>
        </div>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">
          For your security, please change your password after your first sign-in and do not share it with anyone.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
          If you need any help, please contact your AVS Horizon administrator or our support team.
        </p>
        ${buildLoginSectionHtml()}
      </div>
    </div>
  </div>
`;

const getMailAuthorityTokenEndpoint = (): string => {
  const authority = env.mailAuthority || `https://login.microsoftonline.com/${env.mailTenantId}`;
  return `${authority.replace(/\/+$/, '')}/oauth2/v2.0/token`;
};

const getMailGraphAccessToken = async (): Promise<string> => {
  assertMailEnv();
  const body = new URLSearchParams({
    client_id: env.mailClientId,
    client_secret: env.mailClientSecret,
    scope: env.mailGraphScope,
    grant_type: 'client_credentials',
  });

  const response = await fetch(getMailAuthorityTokenEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload?.access_token !== 'string') {
    throw new Error(payload?.error_description || payload?.error || 'Failed to acquire mail graph token.');
  }

  return payload.access_token;
};

const callMailGraph = async (path: string, init: RequestInit): Promise<void> => {
  const token = await getMailGraphAccessToken();
  const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (response.ok) return;

  const payload = await response.json().catch(() => ({}));
  throw new Error(payload?.error?.message || payload?.error_description || `Mail request failed (${response.status})`);
};

export const sendWelcomeCredentialsEmail = async (params: {
  email: string;
  displayName: string;
  temporaryPassword: string;
}): Promise<void> => {
  await callMailGraph(`/users/${encodeURIComponent(env.mailSender)}/sendMail`, {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject: 'Your AVS Horizon account is ready',
        body: {
          contentType: 'HTML',
          content: buildWelcomeEmailHtml(params),
        },
        toRecipients: [
          {
            emailAddress: {
              address: params.email,
            },
          },
        ],
      },
      saveToSentItems: false,
    }),
  });
};
