'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/social-media-previewer.js');

function fixture(overrides = {}) {
    const field = (value, source = 'test') => ({ value, source });
    const image = field('https://example.test/social.jpg');
    const title = field('A useful title');
    const description = field('A useful description');
    const imageAlt = field('Description of the image');
    const data = {
        url: field('https://example.test/page'),
        siteName: field('Example'),
        type: field('website'),
        locale: field('de_DE'),
        title,
        description,
        image,
        imageAlt,
        imageWidth: 1200,
        imageHeight: 630,
        xCard: field('summary_large_image'),
        raw: {
            ogTitle: title.value,
            ogDescription: description.value,
            ogImage: image.value,
            ogUrl: 'https://example.test/page',
            ogType: 'website',
            twitterCard: 'summary_large_image'
        },
        platform: {
            x: { title, description, image, imageAlt },
            facebook: { title, description, image, imageAlt },
            telegram: { title, description, image, imageAlt },
            nostr: { title, description, image, imageAlt },
            linkedin: { title, description, image, imageAlt },
            bluesky: { title, description, image, imageAlt },
            mastodon: { title, description, image, imageAlt }
        }
    };
    return Object.assign(data, overrides);
}

test('normalizes whitespace without changing content', () => {
    assert.equal(core.clean('  Hello\n  world  '), 'Hello world');
});

test('resolves relative media URLs', () => {
    assert.equal(core.absoluteUrl('/image.jpg', 'https://example.test/news/'), 'https://example.test/image.jpg');
});

test('accepts a complete X large-image card', () => {
    assert.deepEqual(core.audit(fixture(), 'x'), [
        { level: 'ok', text: 'All data relevant to this local check is present.' }
    ]);
});

test('reports missing title and image', () => {
    const data = fixture();
    data.platform.facebook.title = { value: '', source: 'missing' };
    data.platform.facebook.image = { value: '', source: 'missing' };
    const issues = core.audit(data, 'facebook');
    assert.ok(issues.some((item) => item.level === 'error' && item.text.includes('Title')));
    assert.ok(issues.some((item) => item.level === 'error' && item.text.includes('Preview image')));
});

test('warns about an unsuitable X image ratio', () => {
    const data = fixture({ imageWidth: 1200, imageHeight: 1200 });
    const issues = core.audit(data, 'x');
    assert.ok(issues.some((item) => item.text.includes('2:1')));
});

test('warns when an X player card can only be approximated', () => {
    const data = fixture();
    data.raw.twitterCard = 'player';
    data.xCard = { value: 'player', source: 'twitter:card' };
    const issues = core.audit(data, 'x');
    assert.ok(issues.some((item) => item.level === 'warning' && item.text.includes('player cards')));
});

test('treats missing Facebook Open Graph basics as errors despite local fallbacks', () => {
    const data = fixture();
    data.raw.ogTitle = '';
    data.raw.ogImage = '';
    data.raw.ogUrl = '';
    data.raw.ogType = '';
    const issues = core.audit(data, 'facebook');
    assert.equal(issues.filter((item) => item.level === 'error').length, 4);
});

test('warns when Telegram has to rely on non-Open-Graph fallbacks', () => {
    const data = fixture();
    data.raw.ogImage = '';
    const issues = core.audit(data, 'telegram');
    assert.ok(issues.some((item) => item.level === 'warning' && item.text.includes('server-side')));
});

test('makes Nostr client variance explicit', () => {
    const issues = core.audit(fixture(), 'nostr');
    assert.ok(issues.some((item) => item.level === 'info' && item.text.includes('single link-card layout')));
});

test('treats missing LinkedIn Open Graph fields as errors', () => {
    const data = fixture();
    data.raw.ogTitle = '';
    data.raw.ogDescription = '';
    data.raw.ogImage = '';
    data.raw.ogUrl = '';
    const issues = core.audit(data, 'linkedin');
    assert.equal(issues.filter((item) => item.level === 'error').length, 4);
});

test('accepts a complete LinkedIn card at 1200 by 630 pixels', () => {
    assert.deepEqual(core.audit(fixture(), 'linkedin'), [
        { level: 'ok', text: 'All data relevant to this local check is present.' }
    ]);
});

test('explains that Bluesky cards are created by the posting app', () => {
    const issues = core.audit(fixture(), 'bluesky');
    assert.ok(issues.some((item) => item.level === 'info' && item.text.includes('external embed')));
});

test('warns about incomplete Open Graph data for Mastodon', () => {
    const data = fixture();
    data.raw.ogDescription = '';
    const issues = core.audit(data, 'mastodon');
    assert.ok(issues.some((item) => item.level === 'warning' && item.text.includes('preview cards')));
    assert.ok(issues.some((item) => item.level === 'info' && item.text.includes('instance')));
});

test('uses injected translations for JavaScript messages', () => {
    const source = 'All data relevant to this local check is present.';
    assert.deepEqual(core.audit(fixture(), 'x', { [source]: 'Übersetzter Text.' }), [
        { level: 'ok', text: 'Übersetzter Text.' }
    ]);
});

test('uses Concrete scoped Bootstrap UI instead of custom interface components', () => {
    const script = fs.readFileSync(path.join(__dirname, '../js/social-media-previewer.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '../css/social-media-previewer.css'), 'utf8');

    assert.match(script, /'ccm-ui'/);
    assert.match(script, /modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable/);
    assert.match(script, /nav nav-tabs/);
    assert.match(script, /alert alert-/);
    assert.match(script, /text-danger/);
    assert.match(script, /text-success/);
    assert.match(script, /flex-wrap flex-grow-1/);
    assert.doesNotMatch(script, /badge rounded-pill/);
    assert.doesNotMatch(script, /overflow-auto border-0 px-3/);
    assert.doesNotMatch(script, /scrollIntoView/);
    assert.match(script, /border-bottom position-relative/);
    assert.doesNotMatch(script, /border-bottom position-relative pt-2/);
    assert.doesNotMatch(script, /(Titel fehlt|Prüfung|Vorschau|Schließen|Vorherige Plattform)/);
    for (const locale of ['de_DE', 'fr_FR', 'it_IT']) {
        const catalog = path.join(__dirname, `../languages/${locale}/LC_MESSAGES/messages`);
        assert.ok(fs.existsSync(`${catalog}.po`));
        assert.ok(fs.existsSync(`${catalog}.mo`));
    }
    assert.doesNotMatch(css, /\.smp-(modal|dialog|header|close|audit-item|source)\b/);
});

test('provides the Concrete package icon as a 97 by 97 pixel PNG', () => {
    const icon = fs.readFileSync(path.join(__dirname, '../icon.png'));

    assert.deepEqual(icon.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(icon.readUInt32BE(16), 97);
    assert.equal(icon.readUInt32BE(20), 97);
});

test('disables the preview and its assets on dashboard paths', () => {
    const controller = fs.readFileSync(path.join(__dirname, '../menu_items/social_media_previewer/controller.php'), 'utf8');
    const guardPosition = controller.indexOf('if (!$this->isPreviewablePage($page))');
    const assetPosition = controller.indexOf("requireAsset('css', 'social-media-previewer')");

    assert.match(controller, /\$path !== '\/dashboard'/);
    assert.match(controller, /strpos\(\$path, '\/dashboard\/'\) !== 0/);
    assert.ok(guardPosition !== -1 && assetPosition !== -1 && guardPosition < assetPosition);
});

test('declares and includes the MIT license', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

    assert.equal(packageJson.license, 'MIT');
    assert.ok(fs.existsSync(path.join(__dirname, '../LICENSE')));
});
