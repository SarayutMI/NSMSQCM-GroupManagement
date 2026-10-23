/** Optional Cloudflare Worker for obtaining a verified LINE groupId.
 * Set LINE_CHANNEL_SECRET as a Worker Secret. This worker never sends messages
 * or accesses Sheets. Copy the verified groupId from Worker logs into E-MOD's
 * LINE_GROUP_ID Script Property; groups are never registered automatically.
 */
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!env.LINE_CHANNEL_SECRET) return new Response('Webhook is not configured', { status: 503 });
    const signature = request.headers.get('x-line-signature');
    if (!signature) return new Response('Invalid signature', { status: 401 });
    const raw = await request.arrayBuffer();
    let verified = false;
    try {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.LINE_CHANNEL_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const bytes = Uint8Array.from(atob(signature), char => char.charCodeAt(0));
      verified = await crypto.subtle.verify('HMAC', key, bytes, raw);
    } catch (err) { /* malformed signature */ }
    if (!verified) return new Response('Invalid signature', { status: 401 });
    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(raw)); }
    catch (err) { return new Response('Invalid JSON', { status: 400 }); }
    for (const event of payload.events || []) {
      if ((event.type === 'join' || event.type === 'message') && event.source?.type === 'group' &&
        /^C[0-9a-f]{32}$/i.test(event.source.groupId)) {
        // Do not log message text, user IDs, signatures, secrets or access tokens.
        console.log(JSON.stringify({ event: 'verified_line_group', groupId: event.source.groupId }));
      }
    }
    return new Response('OK', { status: 200 });
  },
};
