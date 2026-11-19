// #3: the website deploy publishes only the built page and a generated .htaccess whose CSP comes from THIS build
// (index.csp.txt, #297), and the workflow runs only on release tags, after the tests, behind Brian's approval.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');

test('make_site.py writes index.html (the build, unchanged) and an .htaccess with this build\'s policy', () => {
  execFileSync('python3', ['build.py'], { cwd: root }); execFileSync('python3', ['deploy/make_site.py'], { cwd: root });
  const site = path.join(root, 'site');
  assert.deepEqual(fs.readdirSync(site).sort(), ['.htaccess', 'index.html']);
  assert.equal(fs.readFileSync(path.join(site, 'index.html'), 'utf8'), fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  const ht = fs.readFileSync(path.join(site, '.htaccess'), 'utf8');
  const policy = fs.readFileSync(path.join(root, 'index.csp.txt'), 'utf8').split('\n').find(l => l.trim() && !l.startsWith('#'));
  assert.ok(ht.includes(`Header always set Content-Security-Policy "${policy}"`), 'the CSP header is this build\'s policy');
  assert.match(policy, /script-src 'sha256-/); assert.doesNotMatch(policy.split('; style-src')[0], /unsafe-inline/);
  for (const h of ['X-Content-Type-Options "nosniff"', 'Referrer-Policy', 'Permissions-Policy', 'Strict-Transport-Security "max-age=86400"', 'Options -Indexes', 'RewriteCond %{HTTPS} !=on'])
    assert.ok(ht.includes(h), h);
});

test('the deploy workflow: tags only, tests first, production environment, read-only token, pinned actions', () => {
  const wf = fs.readFileSync(path.join(root, '..', '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.match(wf, /on:\n  push:\n    tags: \['v\*'\]\npermissions:\n  contents: read/);
  assert.doesNotMatch(wf, /pull_request|workflow_dispatch|branches:/);
  assert.match(wf, /needs: build-and-test[\s\S]*environment: production/);
  assert.match(wf, /bash tests\/run_all\.sh/);
  (wf.match(/uses: \S+/g) || []).forEach(u => assert.match(u, /@[0-9a-f]{40}$/, `${u} is pinned to a commit`));
  assert.match(wf, /StrictHostKeyChecking=yes/);
});

test('TE-B-317: the page carries the TE-mark favicon from the art pack, inlined as a data: icon', () => {
  execFileSync('python3', ['build.py'], { cwd: root });
  const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = page.match(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)">/);
  assert.ok(m, 'one icon link in the page');
  const svg = fs.readFileSync(path.join(root, '..', 'docs', 'art-website-pack', 'favicon', 'favicon.svg'), 'utf8').trim();
  assert.equal(Buffer.from(m[1], 'base64').toString('utf8'), svg, 'the same icon as the art pack');
  assert.equal((page.match(/rel="icon"/g) || []).length, 1);
  const policy = fs.readFileSync(path.join(root, 'index.csp.txt'), 'utf8');
  assert.match(policy, /img-src 'self' data:/, 'the CSP lets the data: icon load');
});
