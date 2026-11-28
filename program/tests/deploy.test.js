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

test('the deploy workflow: v* tags only (pushed by hand, or dispatched ON the tag by release.yml); tests first, production environment, read-only token, pinned actions', () => {
  const wf = yamlLines('deploy.yml');
  // the two ways in, and no other: a pushed v* tag, or workflow_dispatch with no inputs (release.yml starts it with --ref <tag>, TE-B-570, Black Hat TE-B-632)
  assert.match(wf, /\non:\n  push:\n    tags: \['v\*'\]\n  workflow_dispatch:\npermissions:\n  contents: read\n/, 'on: push tags v* and workflow_dispatch (no inputs) only, then contents: read');
  assert.doesNotMatch(wf, /pull_request|workflow_call|repository_dispatch|schedule:|branches:|release:|inputs/);
  assert.equal((wf.match(/^permissions:/gm) || []).length, 1, 'one permissions block, the read-only one at the top');
  assert.doesNotMatch(wf, /contents: write/);
  // a dispatch on a branch never builds: the first job runs only on a v* tag (and production allows only v* tags)
  assert.match(wf, /  build-and-test:\n    if: startsWith\(github\.ref, 'refs\/tags\/v'\)\n/);
  assert.match(wf, /ref: \$\{\{ github\.ref \}\}/);
  assert.match(wf, /persist-credentials: false/);
  assert.match(wf, /needs: build-and-test[\s\S]*environment: production/);
  assert.match(wf, /bash tests\/run_all\.sh/);
  assert.match(wf, /RELEASE_TAG: \$\{\{ github\.ref_name \}\}/, 'the upload names its files after the tag');
  assert.doesNotMatch(wf, /GITHUB_REF_NAME|secrets: inherit/);
  pinned(wf);
  assert.match(wf, /StrictHostKeyChecking=yes/);
});

test('the release workflow (TE-B-570): only a merged release-name PR into balsaPixel-1.0, pre-release versions only, the gate tree, no moved tags, GITHUB_TOKEN only, then deploy.yml started ON the tag', () => {
  const wf = yamlLines('release.yml');
  assert.match(wf, /\non:\n  pull_request:\n    types: \[closed\]\n    branches: \[balsaPixel-1\.0\]\npermissions:\n  contents: read\n/, 'one trigger: a closed pull request into balsaPixel-1.0; read-only by default');
  assert.doesNotMatch(wf, /push:|workflow_dispatch|repository_dispatch|schedule:|pull_request_target/);
  assert.match(wf, /if: github\.event\.pull_request\.merged == true && startsWith\(github\.event\.pull_request\.title, 'Release name 1\.0\.0-'\)/, 'only a MERGED pull request whose title is a release name');
  // write access only inside the tag job: contents (the tag and release) and actions (to start deploy.yml), nothing else
  assert.equal((wf.match(/contents: write/g) || []).length, 1);
  assert.equal((wf.match(/actions: write/g) || []).length, 1);
  assert.equal((wf.match(/^    permissions:/gm) || []).length, 1, 'one job-level permissions block');
  assert.match(wf, /  tag:\n[\s\S]*?    permissions:\n      contents: write\n      actions: write\n    steps:/);
  assert.doesNotMatch(wf, /secrets\.[A-Z_]+|secrets: inherit|uses: \.\//, 'no named secret, no secrets passed on, no called workflow');
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
  // the deploy: deploy.yml started ON the tag just made (its github.ref is the tag, so production's v* rule applies), after the release
  assert.match(wf, /gh release create[\s\S]*\n          gh workflow run deploy\.yml --repo "\$REPO" --ref "\$TAG"\n/);
  assert.equal((wf.match(/gh workflow run/g) || []).length, 1);
  pinned(wf);
});

test('TE-B-317, ART-O3: the page carries the four tab icons from the art pack, inlined as data: icons; one is picked per page load', () => {
  execFileSync('python3', ['build.py'], { cwd: root });
  const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const four = path.join(root, '..', 'docs', 'art-website-pack', 'favicon', 'four');
  const names = ['a-pixel-b', 'b-cream-b', 'c-truss-b', 'd-te-mark'];
  const files = names.map(n => fs.readFileSync(path.join(four, n + '.svg'), 'utf8').trim());
  for (const [i, svg] of files.entries()) assert.ok(!/<script|href=/i.test(svg), names[i] + ' holds no script and no link');
  // one icon link, starting as D, the TE mark, which is still the same bytes as the pack's favicon.svg
  const m = page.match(/<link rel="icon" id="tabIcon" type="image\/svg\+xml" href="data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)">/);
  assert.ok(m, 'one icon link in the page');
  assert.equal((page.match(/rel="icon"/g) || []).length, 1);
  assert.equal(Buffer.from(m[1], 'base64').toString('utf8'), files[3], 'the link starts as D, the TE mark');
  assert.equal(files[3], fs.readFileSync(path.join(root, '..', 'docs', 'art-website-pack', 'favicon', 'favicon.svg'), 'utf8').trim(), 'D is favicon.svg');
  // the pick script right after it holds the four as data: URIs, in the pack's order, and nothing else runs there
  const s = page.match(/<link rel="icon" id="tabIcon"[^\n]*\n<script>(\/\* ART-O3[\s\S]*?)<\/script>/);
  assert.ok(s, 'the pick script follows the link');
  const uris = [...s[1].matchAll(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g)].map(x => Buffer.from(x[1], 'base64').toString('utf8'));
  assert.deepStrictEqual(uris, files, 'the four icons, as in the pack');
  assert.match(s[1], /Math\.random\(\)\*u\.length/, 'picked at random');
  assert.ok(!/fetch|XMLHttpRequest|eval|import\(|document\.write/.test(s[1]), 'the pick script loads nothing');
  // the CSP lets the data: icons load and allows the pick script by its hash, like every other inline script
  const policy = fs.readFileSync(path.join(root, 'index.csp.txt'), 'utf8');
  assert.match(policy, /img-src 'self' data:/, 'the CSP lets the data: icon load');
  const hash = require('crypto').createHash('sha256').update(s[1], 'utf8').digest('base64');
  assert.ok(policy.includes(`'sha256-${hash}'`), 'the pick script is in the policy by hash');
});
