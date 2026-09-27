'use strict';
// Optional destructive staging check. Never included in the unit-test command.
async function main(env = process.env, request = fetch) {
    if (env.ALLOW_REPORT_MUTATION !== 'true') throw new Error('Explicit staging report mutation approval is required.');
    let base;
    try { base = new URL(env.HUMANAID_TEST_API_URL); } catch { throw new Error('A local or staging API URL is required.'); }
    const hostname = base.hostname.toLowerCase().replace(/\.$/, '');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
    if (['humanaidapp.org', 'www.humanaidapp.org', 'gocasino-1ecc9.web.app', 'gocasino-1ecc9.firebaseapp.com'].includes(hostname)) {
        throw new Error('This check cannot target production.');
    }
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash ||
        (!local && (base.protocol !== 'https:' || env.HUMANAID_STAGING_ORIGIN !== base.origin))) {
        throw new Error('Configure an explicit local or staging origin.');
    }
    if (!/^[1-9][0-9]*$/.test(env.REPORT_ID || '') || !env.FIREBASE_ID_TOKEN) throw new Error('A staging report ID and Firebase admin ID token are required.');
    const url = `${base.href.replace(/\/$/, '')}/admin/reports/${env.REPORT_ID}/resolve`;
    const response = await request(url, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.FIREBASE_ID_TOKEN}` },
        body: JSON.stringify({ status: 'resolved' })
    });
    if (!response.ok) throw new Error('Staging report check was rejected.');
    return true;
}
if (require.main === module) {
    main().then(() => console.log('Staging report check passed.')).catch(() => {
        console.error('Staging report check failed. Review the target, approval and authentication configuration.');
        process.exitCode = 1;
    });
}
module.exports = { main };
