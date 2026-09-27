'use strict';

// Retired: fabricated UIDs and email-based bootstrap must not create administrators.
function main() {
    throw new Error('This unsafe bootstrap was retired. Use promote_admin.js with an enabled, verified Firebase identity.');
}

if (require.main === module) {
    try { main(); } catch {
        console.error('This unsafe bootstrap was retired. Use promote_admin.js with an enabled, verified Firebase identity.');
        process.exitCode = 1;
    }
}

module.exports = { main };
