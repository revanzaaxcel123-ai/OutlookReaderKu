export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let refreshToken = '';
    let clientId = '000000004017045b';
    let scope = '';

    if (contentType.includes('application/json')) {
      const json = await req.json();
      refreshToken = json.refresh_token || '';
      clientId = json.client_id || clientId;
      scope = json.scope || '';
    } else {
      const rawText = await req.text();
      const params = new URLSearchParams(rawText);
      refreshToken = params.get('refresh_token') || '';
      clientId = params.get('client_id') || clientId;
      scope = params.get('scope') || '';
    }

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'Missing refresh_token' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Deteksi akun personal vs korporat (Entra / Azure AD)
    const isConsumer =
      refreshToken.startsWith('M.C') ||
      refreshToken.startsWith('M.R') ||
      clientId === '000000004017045b';

    const tokenUrl = isConsumer
      ? 'https://login.live.com/oauth20_token.srf'
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const formParams = new URLSearchParams();
    formParams.append('client_id', clientId);
    formParams.append('grant_type', 'refresh_token');
    formParams.append('refresh_token', refreshToken);

    if (!isConsumer) {
      formParams.append(
        'scope',
        scope || 'https://graph.microsoft.com/.default offline_access'
      );
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: formParams.toString(),
    });

    const data = await tokenResponse.json();

    return new Response(JSON.stringify(data), {
      status: tokenResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Proxy failed to reach OAuth' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
