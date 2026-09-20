export default async function handler(req: Request) {

    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }


    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    }


    try {

        const rawBody = await req.text();


        const tokenResponse = await fetch(
            'https://login.live.com/oauth20_token.srf',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0'
                },
                body: rawBody
            }
        );


        const data = await tokenResponse.json();


        return new Response(
            JSON.stringify(data),
            {
                status: tokenResponse.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );


    } catch (error) {

        return new Response(
            JSON.stringify({
                error: 'Proxy failed to reach Live OAuth'
            }),
            {
                status: 502,
                headers:{
                    'Content-Type':'application/json',
                    'Access-Control-Allow-Origin':'*'
                }
            }
        );
    }
}
