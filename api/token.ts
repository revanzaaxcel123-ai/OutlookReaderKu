import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Izinkan CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refresh_token, client_id, scope } = req.body || {};

    if (!refresh_token) {
      return res.status(400).json({ error: 'Missing refresh_token parameter' });
    }

    // Deteksi akun personal (MSA/Live.com) vs Azure AD
    const isConsumer = refresh_token.startsWith('M.C') || refresh_token.startsWith('M.R') || client_id === '000000004017045b';

    const tokenUrl = isConsumer
      ? 'https://login.live.com/oauth20_token.srf'
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const params = new URLSearchParams();
    params.append('client_id', client_id || '000000004017045b');
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refresh_token);

    if (!isConsumer) {
      params.append('scope', scope || 'https://graph.microsoft.com/.default offline_access');
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
