/**
 * Sets GitHub Actions secrets on the bill-lens repo.
 * Usage: node scripts/set-github-secrets.mjs
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import pkg from 'tweetsodium';
const { seal } = pkg;

const REPO = 'JustCasey76/bill-lens';
const GH_TOKEN = process.env.GH_TOKEN;

if (!GH_TOKEN) {
    console.error('Set GH_TOKEN env var first');
    process.exit(1);
}

const headers = {
    Authorization: `token ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
};

// 1. Get the repo public key
async function getPublicKey() {
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/secrets/public-key`, { headers });
    if (!res.ok) throw new Error(`Failed to get public key: ${res.status} ${await res.text()}`);
    return res.json();
}

// 2. Encrypt a secret value
function encryptSecret(publicKey, secretValue) {
    const keyBytes = Buffer.from(publicKey, 'base64');
    const secretBytes = Buffer.from(secretValue);
    const encrypted = seal(secretBytes, keyBytes);
    return Buffer.from(encrypted).toString('base64');
}

// 3. Set a secret
async function setSecret(keyId, publicKey, name, value) {
    const encrypted = encryptSecret(publicKey, value);
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/secrets/${name}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted_value: encrypted, key_id: keyId }),
    });
    if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`Failed to set ${name}: ${res.status} ${text}`);
    }
    return res.status;
}

// Collect secrets from env vars and firebase config
function collectSecrets() {
    const secrets = {};

    // Firebase token from config
    const fbConfigPath = join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
    try {
        const fbConfig = JSON.parse(readFileSync(fbConfigPath, 'utf-8'));
        if (fbConfig.tokens?.refresh_token) {
            secrets.FIREBASE_TOKEN = fbConfig.tokens.refresh_token;
        }
    } catch (e) {
        console.warn('Could not read Firebase config:', e.message);
    }

    // Read .env.local
    const envPath = join(process.cwd(), '.env.local');
    try {
        const lines = readFileSync(envPath, 'utf-8').split('\n');
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const eqIdx = line.indexOf('=');
            if (eqIdx < 1) continue;
            const key = line.substring(0, eqIdx).trim();
            const value = line.substring(eqIdx + 1).trim();
            if (value.length > 0 && /^[A-Z][A-Z0-9_]*$/.test(key)) {
                // Skip NEXTAUTH_URL as it differs per environment
                if (key === 'NEXTAUTH_URL') continue;
                secrets[key] = value;
            }
        }
    } catch (e) {
        console.warn('Could not read .env.local:', e.message);
    }

    return secrets;
}

async function main() {
    console.log('Fetching repo public key...');
    const { key: publicKey, key_id: keyId } = await getPublicKey();
    console.log(`Public key ID: ${keyId}`);

    const secrets = collectSecrets();
    console.log(`\nSetting ${Object.keys(secrets).length} secrets on ${REPO}:\n`);

    for (const [name, value] of Object.entries(secrets)) {
        try {
            const status = await setSecret(keyId, publicKey, name, value);
            console.log(`  ✓ ${name} (${value.length} chars)`);
        } catch (e) {
            console.error(`  ✗ ${name}: ${e.message}`);
        }
    }

    console.log('\nDone! Triggering workflow...');

    // Trigger the workflow
    const dispatchRes = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/firebase-deploy.yml/dispatches`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'main' }),
    });

    if (dispatchRes.ok || dispatchRes.status === 204) {
        console.log('✓ Workflow triggered! Check: https://github.com/JustCasey76/bill-lens/actions');
    } else {
        console.error(`✗ Failed to trigger workflow: ${dispatchRes.status} ${await dispatchRes.text()}`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
