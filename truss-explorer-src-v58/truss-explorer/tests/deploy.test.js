// #3 (plan c, main): the website deploy publishes only the committed page and a generated .htaccess whose CSP allows
// exactly this page's inline scripts by hash, and the workflow runs only on release tags, after the tests, behind approval.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');

test('make_site.py: index.html unchanged, and an .htaccess whose CSP hashes are this page\'s scripts', () => {
  execFileSync('python3', ['deploy/make_site.py'], { cwd: root });
  const site = path.join(root, 'site'), page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(fs.readFileSync(path.join(site, 'index.html'), 'utf8'), page);
  const ht = fs.readFileSync(path.join(site, '.htaccess'), 'utf8');
  const want = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  assert.ok(want.length > 0);
  want.forEach(h => assert.ok(ht.includes(h), 'hash ' + h));
  const csp = ht.match(/Content-Security-Policy "([^"]+)"/)[1];
  assert.doesNotMatch(csp.split('; style-src')[0], /unsafe-inline/);
  for (const h of ['X-Content-Type-Options "nosniff"', 'Strict-Transport-Security "max-age=86400"', 'Options -Indexes', 'RewriteCond %{HTTPS} !=on']) assert.ok(ht.includes(h), h);
});

test('the deploy workflow: tags only, tests first, production environment, read-only token, pinned actions', () => {
  const wf = fs.readFileSync(path.join(root, '..', '..', '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.match(wf, /on:\n  push:\n    tags: \['v\*'\]\npermissions:\n  contents: read/);
  assert.doesNotMatch(wf, /pull_request|workflow_dispatch|branches:/);
  assert.match(wf, /needs: build-and-test[\s\S]*environment: production/);
  (wf.match(/uses: \S+/g) || []).forEach(u => assert.match(u, /@[0-9a-f]{40}$/, u));
});
