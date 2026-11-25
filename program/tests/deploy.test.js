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

// the lines of a workflow file without its comments (so a comment can't satisfy or trip a rule)
const yamlLines = f => fs.readFileSync(path.join(root, '..', '.github', 'workflows', f), 'utf8').split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
const pinned = wf => (wf.match(/uses: \S+/g) || []).forEach(u => { if (/^uses: \.\//.test(u)) return; assert.match(u, /^uses: actions\/[a-z-]+@[0-9a-f]{40}$/, `${u} is a GitHub-owned action pinned to a commit`); });

test('the deploy workflow: tags only, or a call from release.yml with the tag it made; tests first, production environment, read-only token, pinned actions', () => {
  const wf = yamlLines('deploy.yml');
  // the two ways in, and no other: a pushed v* tag (a release made by hand), or workflow_call with one required string input, the tag (TE-B-570)
  assert.match(wf, /\non:\n  push:\n    tags: \['v\*'\]\n  workflow_call:\n    inputs:\n      tag:\n(?:        \S.*\n)*?        required: true\n(?:        \S.*\n)*?        type: string\n(?:        \S.*\n)*permissions:\n  contents: read\n/, 'on: push tags v* and workflow_call(tag) only, then contents: read');
  assert.doesNotMatch(wf, /pull_request|workflow_dispatch|repository_dispatch|schedule:|branches:|release:/);
  assert.equal((wf.match(/^permissions:/gm) || []).length, 1, 'one permissions block, the read-only one at the top');
  assert.doesNotMatch(wf, /contents: write/);
  // when called, it builds the tag it was given, never the caller's ref; by hand, the pushed tag
  assert.match(wf, /ref: \$\{\{ inputs\.tag && format\('refs\/tags\/\{0\}', inputs\.tag\) \|\| github\.ref \}\}/);
  assert.match(wf, /persist-credentials: false/);
  assert.match(wf, /needs: build-and-test[\s\S]*environment: production/);
  assert.match(wf, /bash tests\/run_all\.sh/);
  assert.match(wf, /RELEASE_TAG: \$\{\{ inputs\.tag \|\| github\.ref_name \}\}/, 'the upload names its files after the tag, not the caller\'s ref');
  assert.doesNotMatch(wf, /GITHUB_REF_NAME/, 'nothing reads the ref name directly (it is the merge ref when called)');
  pinned(wf);
  assert.match(wf, /StrictHostKeyChecking=yes/);
});

test('the release workflow (TE-B-570): only a merged release-name PR into balsaPixel-1.0, pre-release versions only, the gate tree, no moved tags, GITHUB_TOKEN only, then deploy.yml by workflow_call', () => {
  const wf = yamlLines('release.yml');
  assert.match(wf, /\non:\n  pull_request:\n    types: \[closed\]\n    branches: \[balsaPixel-1\.0\]\npermissions:\n  contents: read\n/, 'one trigger: a closed pull request into balsaPixel-1.0; read-only by default');
  assert.doesNotMatch(wf, /push:|workflow_dispatch|repository_dispatch|schedule:|pull_request_target/);
  assert.match(wf, /if: github\.event\.pull_request\.merged == true && startsWith\(github\.event\.pull_request\.title, 'Release name 1\.0\.0-'\)/, 'only a MERGED pull request whose title is a release name');
  // contents: write only inside the tag job; the deploy job it calls is read-only on its side
  assert.equal((wf.match(/contents: write/g) || []).length, 1);
  assert.match(wf, /  tag:\n[\s\S]*?    permissions:\n      contents: write\n/);
  assert.doesNotMatch(wf, /secrets\.[A-Z_]+/, 'no named secret: the run\'s own token only');
  assert.match(wf, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  // the title reaches the shell only through env, after the pattern; the pattern allows alpha.N, beta.N, rc.N and nothing else (1.0.0 is MAJOR, Brian's)
  assert.match(wf, /TITLE: \$\{\{ github\.event\.pull_request\.title \}\}/);
  assert.doesNotMatch(wf, /run:[^\n]*\$\{\{ github\.event\.pull_request\.title/, 'the title is never pasted into a run line');
  assert.match(wf, /\(1\\\.0\\\.0-\(alpha\|beta\|rc\)\\\.\[1-9\]\[0-9\]\{0,2\}\)/, 'the version pattern');
  assert.match(wf, /if \[ -z "\$v" \]; then[^\n]*exit 1/);
  // the tagged commit is the merge commit, its tree must equal the gate head's tree, and an existing tag is never moved
  assert.match(wf, /ref: \$\{\{ github\.event\.pull_request\.merge_commit_sha \}\}/);
  assert.match(wf, /test "\$\(git rev-parse HEAD\)" = "\$SHA" \|\|[^\n]*exit 1/);
  assert.match(wf, /git\/commits\/\$HEAD_SHA" --jq \.tree\.sha[\s\S]*if \[ "\$ht" != "\$mt" \]; then[^\n]*exit 1/);
  assert.match(wf, /git\/ref\/tags\/\$TAG" >\/dev\/null 2>&1; then[^\n]*never moved[^\n]*exit 1/);
  assert.match(wf, /test -s "\$notes" \|\|[^\n]*exit 1/, 'no notes file, no tag');
  assert.match(wf, /gh release create "\$TAG"[^\n]*--verify-tag --prerelease/);
  // the deploy: deploy.yml itself, with the tag just made, by workflow_call (a GITHUB_TOKEN tag starts no other workflow)
  assert.match(wf, /  deploy:\n    needs: tag\n    permissions:\n      contents: read\n    uses: \.\/\.github\/workflows\/deploy\.yml\n    with:\n      tag: \$\{\{ needs\.tag\.outputs\.tag \}\}\n    secrets: inherit/);
  pinned(wf);
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
