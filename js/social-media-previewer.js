(function (root, factory) {
    'use strict';

    var core = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = core;
    }
    root.SocialMediaPreviewerCore = core;

    if (root.document) {
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', function () { core.mount(root.document); });
        } else {
            core.mount(root.document);
        }
    }
}(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    var PLATFORMS = ['x', 'telegram', 'facebook', 'nostr', 'linkedin', 'bluesky', 'mastodon'];

    function translate(i18n, source) {
        return i18n && i18n[source] ? i18n[source] : source;
    }

    function clean(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function first(candidates) {
        for (var i = 0; i < candidates.length; i += 1) {
            if (clean(candidates[i] && candidates[i].value)) {
                return { value: clean(candidates[i].value), source: candidates[i].source };
            }
        }
        return { value: '', source: 'missing' };
    }

    function absoluteUrl(value, base) {
        if (!clean(value)) return '';
        try {
            return base ? new URL(value, base).href : new URL(value).href;
        } catch (error) {
            return clean(value);
        }
    }

    function hostname(value) {
        try {
            return new URL(value).hostname.replace(/^www\./, '');
        } catch (error) {
            return value;
        }
    }

    function readSeed(doc) {
        var node = doc.getElementById('social-media-previewer-page-data');
        if (!node) return {};
        try {
            return JSON.parse(node.textContent || '{}');
        } catch (error) {
            return {};
        }
    }

    function meta(doc, key) {
        var nodes = doc.querySelectorAll('meta[name], meta[property]');
        var wanted = key.toLowerCase();
        for (var i = 0; i < nodes.length; i += 1) {
            var name = (nodes[i].getAttribute('property') || nodes[i].getAttribute('name') || '').toLowerCase();
            if (name === wanted) return clean(nodes[i].getAttribute('content'));
        }
        return '';
    }

    function link(doc, rel) {
        var nodes = doc.querySelectorAll('link[rel]');
        for (var i = 0; i < nodes.length; i += 1) {
            var rels = (nodes[i].getAttribute('rel') || '').toLowerCase().split(/\s+/);
            if (rels.indexOf(rel) !== -1) return clean(nodes[i].getAttribute('href'));
        }
        return '';
    }

    function jsonLd(doc) {
        var result = {};
        var nodes = doc.querySelectorAll('script[type="application/ld+json"]');
        for (var i = 0; i < nodes.length; i += 1) {
            try {
                var parsed = JSON.parse(nodes[i].textContent || '{}');
                var item = Array.isArray(parsed) ? parsed[0] : parsed;
                if (item && item['@graph']) item = item['@graph'][0];
                if (!item || typeof item !== 'object') continue;
                result.title = result.title || item.headline || item.name;
                result.description = result.description || item.description;
                var image = item.image;
                if (Array.isArray(image)) image = image[0];
                if (image && typeof image === 'object') image = image.url || image.contentUrl;
                result.image = result.image || image;
            } catch (error) {
                // Invalid JSON-LD should not prevent the editor preview.
            }
        }
        return result;
    }

    function firstContentImage(doc) {
        var images = doc.querySelectorAll('main img, article img, [role="main"] img, img');
        for (var i = 0; i < images.length; i += 1) {
            if (images[i].closest('#ccm-toolbar, #social-media-previewer-modal')) continue;
            var width = images[i].naturalWidth || Number(images[i].getAttribute('width')) || 0;
            var height = images[i].naturalHeight || Number(images[i].getAttribute('height')) || 0;
            if ((!width || width >= 160) && (!height || height >= 90)) {
                return {
                    value: images[i].currentSrc || images[i].src || '',
                    alt: clean(images[i].getAttribute('alt')),
                    width: width,
                    height: height
                };
            }
        }
        return { value: '', alt: '', width: 0, height: 0 };
    }

    function collect(doc) {
        var seed = readSeed(doc);
        var structured = jsonLd(doc);
        var domImage = firstContentImage(doc);
        var locationUrl = doc.defaultView && doc.defaultView.location ? doc.defaultView.location.href : '';
        var base = locationUrl || doc.baseURI || '';
        var canonical = first([
            { value: link(doc, 'canonical'), source: 'link[rel=canonical]' },
            { value: meta(doc, 'og:url'), source: 'og:url' },
            { value: locationUrl, source: 'current URL' }
        ]);
        canonical.value = absoluteUrl(canonical.value, base);

        var baseTitle = first([
            { value: meta(doc, 'og:title'), source: 'og:title' },
            { value: seed.metaTitle, source: 'Concrete meta_title' },
            { value: doc.title, source: '<title>' },
            { value: doc.querySelector('h1') && doc.querySelector('h1').textContent, source: 'first H1' },
            { value: structured.title, source: 'JSON-LD' },
            { value: seed.name, source: 'Concrete page name' }
        ]);
        var baseDescription = first([
            { value: meta(doc, 'og:description'), source: 'og:description' },
            { value: meta(doc, 'description'), source: 'meta description' },
            { value: seed.metaDescription, source: 'Concrete meta_description' },
            { value: seed.description, source: 'Concrete page description' },
            { value: structured.description, source: 'JSON-LD' },
            { value: doc.querySelector('main p, article p, [role="main"] p') && doc.querySelector('main p, article p, [role="main"] p').textContent, source: 'first paragraph' }
        ]);
        var baseImage = first([
            { value: meta(doc, 'og:image'), source: 'og:image' },
            { value: meta(doc, 'og:image:url'), source: 'og:image:url' },
            { value: meta(doc, 'og:image:secure_url'), source: 'og:image:secure_url' },
            { value: seed.thumbnail, source: 'Concrete thumbnail' },
            { value: structured.image, source: 'JSON-LD' },
            { value: domImage.value, source: 'first content image' }
        ]);
        baseImage.value = absoluteUrl(baseImage.value, base);

        var data = {
            url: canonical,
            siteName: first([
                { value: meta(doc, 'og:site_name'), source: 'og:site_name' },
                { value: hostname(canonical.value), source: 'domain' }
            ]),
            type: first([
                { value: meta(doc, 'og:type'), source: 'og:type' },
                { value: 'website', source: 'default value' }
            ]),
            locale: first([
                { value: meta(doc, 'og:locale'), source: 'og:locale' },
                { value: doc.documentElement.lang, source: 'html[lang]' }
            ]),
            title: baseTitle,
            description: baseDescription,
            image: baseImage,
            imageAlt: first([
                { value: meta(doc, 'og:image:alt'), source: 'og:image:alt' },
                { value: domImage.alt, source: 'image alt text' }
            ]),
            imageWidth: Number(meta(doc, 'og:image:width')) || domImage.width || 0,
            imageHeight: Number(meta(doc, 'og:image:height')) || domImage.height || 0,
            xCard: first([
                { value: meta(doc, 'twitter:card'), source: 'twitter:card' },
                { value: 'summary_large_image', source: 'preview default' }
            ]),
            raw: {
                ogTitle: meta(doc, 'og:title'),
                ogDescription: meta(doc, 'og:description'),
                ogImage: meta(doc, 'og:image') || meta(doc, 'og:image:url') || meta(doc, 'og:image:secure_url'),
                ogUrl: meta(doc, 'og:url'),
                ogType: meta(doc, 'og:type'),
                twitterCard: meta(doc, 'twitter:card')
            }
        };

        data.platform = {
            x: {
                title: first([{ value: meta(doc, 'twitter:title'), source: 'twitter:title' }, baseTitle]),
                description: first([{ value: meta(doc, 'twitter:description'), source: 'twitter:description' }, baseDescription]),
                image: first([
                    { value: meta(doc, 'twitter:image'), source: 'twitter:image' },
                    { value: meta(doc, 'twitter:image:src'), source: 'twitter:image:src' },
                    baseImage
                ]),
                imageAlt: first([{ value: meta(doc, 'twitter:image:alt'), source: 'twitter:image:alt' }, data.imageAlt])
            },
            facebook: { title: baseTitle, description: baseDescription, image: baseImage, imageAlt: data.imageAlt },
            telegram: { title: baseTitle, description: baseDescription, image: baseImage, imageAlt: data.imageAlt },
            nostr: { title: baseTitle, description: baseDescription, image: baseImage, imageAlt: data.imageAlt },
            linkedin: { title: baseTitle, description: baseDescription, image: baseImage, imageAlt: data.imageAlt },
            bluesky: { title: baseTitle, description: baseDescription, image: baseImage, imageAlt: data.imageAlt },
            mastodon: { title: baseTitle, description: baseDescription, image: baseImage, imageAlt: data.imageAlt }
        };
        data.platform.x.image.value = absoluteUrl(data.platform.x.image.value, base);

        return data;
    }

    function issue(level, text) {
        return { level: level, text: text };
    }

    function audit(data, platform, i18n) {
        var p = data.platform[platform];
        var issues = [];
        if (!p.title.value) issues.push(issue('error', translate(i18n, 'Title is missing.')));
        if (!p.description.value) issues.push(issue('warning', translate(i18n, 'Description is missing; the card will appear incomplete.')));
        if (!p.image.value) issues.push(issue('error', translate(i18n, 'Preview image is missing.')));
        if (!data.url.value) issues.push(issue('error', translate(i18n, 'Canonical URL is missing.')));
        if (p.image.value && !/^https?:\/\//i.test(p.image.value)) {
            issues.push(issue('warning', translate(i18n, 'The image URL is not an absolute HTTP(S) URL.')));
        }

        if (platform === 'x') {
            var allowed = ['summary', 'summary_large_image', 'app', 'player'];
            if (!data.raw.twitterCard) issues.push(issue('warning', translate(i18n, 'twitter:card is missing; X may fall back to Open Graph, but the result is less predictable.')));
            if (data.raw.twitterCard && allowed.indexOf(data.raw.twitterCard) === -1) issues.push(issue('error', translate(i18n, 'twitter:card contains an unknown value.')));
            if (data.raw.twitterCard === 'app' || data.raw.twitterCard === 'player') {
                issues.push(issue('warning', translate(i18n, 'App and player cards are approximated as link cards; embedded app or player features are not executed locally.')));
            }
            if (data.xCard.value === 'summary_large_image' && data.imageWidth && data.imageHeight) {
                var xRatio = data.imageWidth / data.imageHeight;
                if (xRatio < 1.8 || xRatio > 2.2) issues.push(issue('warning', translate(i18n, 'An aspect ratio close to 2:1 is recommended for summary_large_image.')));
                if (data.imageWidth < 300 || data.imageHeight < 157) issues.push(issue('error', translate(i18n, 'The X image is smaller than 300 × 157 px.')));
            }
            if (data.xCard.value === 'summary' && data.imageWidth && data.imageHeight && (data.imageWidth < 144 || data.imageHeight < 144)) {
                issues.push(issue('error', translate(i18n, 'The X thumbnail is smaller than 144 × 144 px.')));
            }
        }

        if (platform === 'facebook') {
            if (!data.raw.ogTitle) issues.push(issue('error', translate(i18n, 'og:title is missing; the current preview only uses a local fallback.')));
            if (!data.raw.ogImage) issues.push(issue('error', translate(i18n, 'og:image is missing; the current preview only uses a local fallback.')));
            if (!data.raw.ogUrl) issues.push(issue('error', translate(i18n, 'og:url is missing; the current preview only uses the canonical or page URL locally.')));
            if (!data.raw.ogType) issues.push(issue('error', translate(i18n, 'og:type is missing; the local preview assumes “website”.')));
            if (data.imageWidth && data.imageHeight) {
                var fbRatio = data.imageWidth / data.imageHeight;
                if (fbRatio < 1.75 || fbRatio > 2.05) issues.push(issue('warning', translate(i18n, 'An aspect ratio of about 1.91:1 (for example 1200 × 630 px) is recommended for large Facebook cards.')));
                if (data.imageWidth < 200 || data.imageHeight < 200) issues.push(issue('error', translate(i18n, 'Facebook requires an image of at least 200 × 200 px.')));
            }
        }

        if (platform === 'telegram' && (!data.raw.ogTitle || !data.raw.ogImage)) {
            issues.push(issue('warning', translate(i18n, 'Telegram generates link previews server-side; complete Open Graph data makes the result more predictable.')));
        }

        if (platform === 'nostr') {
            issues.push(issue('info', translate(i18n, 'Nostr does not define a single link-card layout; rendering and Open Graph processing vary by client.')));
        }

        if (platform === 'linkedin') {
            if (!data.raw.ogTitle) issues.push(issue('error', translate(i18n, 'LinkedIn expects og:title; the current preview only uses a local fallback.')));
            if (!data.raw.ogImage) issues.push(issue('error', translate(i18n, 'LinkedIn expects og:image; the current preview only uses a local fallback.')));
            if (!data.raw.ogDescription) issues.push(issue('error', translate(i18n, 'LinkedIn expects og:description; the current preview only uses a local fallback.')));
            if (!data.raw.ogUrl) issues.push(issue('error', translate(i18n, 'LinkedIn expects og:url; the current preview only uses the canonical or page URL locally.')));
            if (data.imageWidth && data.imageHeight) {
                var linkedinRatio = data.imageWidth / data.imageHeight;
                if (linkedinRatio < 1.75 || linkedinRatio > 2.05) issues.push(issue('warning', translate(i18n, 'LinkedIn recommends an aspect ratio of 1.91:1 for large cards.')));
                if (data.imageWidth < 1200 || data.imageHeight < 627) issues.push(issue('error', translate(i18n, 'The LinkedIn image is smaller than the recommended minimum size of 1200 × 627 px.')));
            }
        }

        if (platform === 'bluesky') {
            if (!data.raw.ogTitle || !data.raw.ogDescription || !data.raw.ogImage) {
                issues.push(issue('warning', translate(i18n, 'Incomplete Open Graph data may prevent a Bluesky app from creating a complete card automatically.')));
            }
            issues.push(issue('info', translate(i18n, 'Bluesky stores the title, description, URL, and optional thumbnail as an external embed in the post; the posting app therefore determines the final card data.')));
        }

        if (platform === 'mastodon') {
            if (!data.raw.ogTitle || !data.raw.ogDescription || !data.raw.ogImage) {
                issues.push(issue('warning', translate(i18n, 'Mastodon generates preview cards from Open Graph; incomplete og: data may result in a reduced card.')));
            }
            issues.push(issue('info', translate(i18n, 'Layout, text truncation, and retrieval timing may vary by Mastodon client and instance.')));
        }

        if (!p.imageAlt.value && p.image.value) issues.push(issue('warning', translate(i18n, 'Alternative text for the preview image is missing.')));
        if (!issues.length) issues.push(issue('ok', translate(i18n, 'All data relevant to this local check is present.')));
        return issues;
    }

    function el(doc, tag, className, text) {
        var node = doc.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function addImage(doc, parent, p, data, rerender, i18n) {
        var box = el(doc, 'div', 'smp-image position-relative overflow-hidden w-100 bg-light');
        if (p.image.value) {
            var img = el(doc, 'img', 'd-block w-100 h-100');
            img.src = p.image.value;
            img.alt = p.imageAlt.value || '';
            img.addEventListener('load', function () {
                if ((!data.imageWidth || !data.imageHeight) && img.naturalWidth && img.naturalHeight) {
                    data.imageWidth = img.naturalWidth;
                    data.imageHeight = img.naturalHeight;
                    rerender(true);
                }
            });
            img.addEventListener('error', function () {
                box.replaceChildren(el(doc, 'span', 'position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center text-muted small', translate(i18n, 'The image could not be loaded')));
            });
            box.appendChild(img);
        } else {
            box.appendChild(el(doc, 'span', 'position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center text-muted small', translate(i18n, 'No preview image')));
        }
        parent.appendChild(box);
    }

    function addText(doc, parent, className, value) {
        parent.appendChild(el(doc, 'div', className, value || '—'));
    }

    function renderCard(doc, stage, platform, data, rerender, i18n) {
        var p = data.platform[platform];
        var domain = data.siteName.value || hostname(data.url.value);
        var card;
        var copy;

        if (platform === 'x') {
            card = el(doc, 'div', 'smp-card smp-x' + (data.xCard.value === 'summary' ? ' is-summary' : ''));
            addImage(doc, card, p, data, rerender, i18n);
            copy = el(doc, 'div', 'smp-x-copy');
            addText(doc, copy, 'smp-card-domain', domain);
            addText(doc, copy, 'smp-card-title', p.title.value);
            if (data.xCard.value !== 'summary') addText(doc, copy, 'smp-card-description', p.description.value);
            card.appendChild(copy);
            stage.appendChild(card);
            return;
        }

        if (platform === 'facebook') {
            card = el(doc, 'div', 'smp-card smp-facebook');
            addImage(doc, card, p, data, rerender, i18n);
            copy = el(doc, 'div', 'smp-facebook-copy');
            addText(doc, copy, 'smp-card-domain', hostname(data.url.value));
            addText(doc, copy, 'smp-card-title', p.title.value);
            addText(doc, copy, 'smp-card-description', p.description.value);
            card.appendChild(copy);
            stage.appendChild(card);
            return;
        }

        if (platform === 'telegram') {
            var tgWrap = el(doc, 'div', 'smp-telegram-wrap w-100 rounded-3 p-3');
            card = el(doc, 'div', 'smp-card smp-telegram');
            addText(doc, card, 'smp-card-domain', domain);
            addText(doc, card, 'smp-card-title', p.title.value);
            addText(doc, card, 'smp-card-description', p.description.value);
            addImage(doc, card, p, data, rerender, i18n);
            tgWrap.appendChild(card);
            stage.appendChild(tgWrap);
            return;
        }

        if (platform === 'linkedin') {
            card = el(doc, 'div', 'smp-card smp-linkedin');
            addImage(doc, card, p, data, rerender, i18n);
            copy = el(doc, 'div', 'smp-linkedin-copy');
            addText(doc, copy, 'smp-card-title', p.title.value);
            addText(doc, copy, 'smp-card-description', p.description.value);
            addText(doc, copy, 'smp-card-domain', hostname(data.url.value));
            card.appendChild(copy);
            stage.appendChild(card);
            return;
        }

        if (platform === 'bluesky') {
            card = el(doc, 'div', 'smp-card smp-bluesky');
            addImage(doc, card, p, data, rerender, i18n);
            copy = el(doc, 'div', 'smp-bluesky-copy');
            addText(doc, copy, 'smp-card-title', p.title.value);
            addText(doc, copy, 'smp-card-description', p.description.value);
            addText(doc, copy, 'smp-card-domain', hostname(data.url.value));
            card.appendChild(copy);
            stage.appendChild(card);
            return;
        }

        if (platform === 'mastodon') {
            card = el(doc, 'div', 'smp-card smp-mastodon');
            addImage(doc, card, p, data, rerender, i18n);
            copy = el(doc, 'div', 'smp-mastodon-copy');
            addText(doc, copy, 'smp-card-domain', hostname(data.url.value));
            addText(doc, copy, 'smp-card-title', p.title.value);
            addText(doc, copy, 'smp-card-description', p.description.value);
            card.appendChild(copy);
            stage.appendChild(card);
            return;
        }

        var nostrWrap = el(doc, 'div', 'smp-nostr-wrap w-100 rounded-3 p-3');
        card = el(doc, 'div', 'smp-card smp-nostr');
        addImage(doc, card, p, data, rerender, i18n);
        copy = el(doc, 'div', 'smp-nostr-copy');
        addText(doc, copy, 'smp-card-domain', hostname(data.url.value));
        addText(doc, copy, 'smp-card-title', p.title.value);
        addText(doc, copy, 'smp-card-description', p.description.value);
        card.appendChild(copy);
        nostrWrap.appendChild(card);
        stage.appendChild(nostrWrap);
    }

    function renderInspector(doc, inspector, platform, data, i18n) {
        var p = data.platform[platform];
        var issues = audit(data, platform, i18n);
        inspector.appendChild(el(doc, 'h3', 'h6 mb-3', translate(i18n, 'Check')));
        var list = el(doc, 'ul', 'list-unstyled mb-4');
        issues.forEach(function (item) {
            var alertClass = item.level === 'error' ? 'danger' : item.level === 'warning' ? 'warning' : item.level === 'info' ? 'info' : 'success';
            var li = el(doc, 'li', 'alert alert-' + alertClass + ' d-flex align-items-start gap-2 py-2 px-3 mb-2 small');
            li.appendChild(el(doc, 'span', 'fw-bold flex-shrink-0', item.level === 'error' ? '×' : item.level === 'warning' ? '!' : item.level === 'info' ? 'i' : '✓'));
            li.appendChild(el(doc, 'span', '', item.text));
            list.appendChild(li);
        });
        inspector.appendChild(list);
        inspector.appendChild(el(doc, 'h3', 'h6 mb-3', translate(i18n, 'Data used')));
        var fields = el(doc, 'dl', 'border-top mb-0');
        [
            [translate(i18n, 'Title'), p.title],
            [translate(i18n, 'Description'), p.description],
            [translate(i18n, 'Image'), p.image],
            [translate(i18n, 'Image alt text'), p.imageAlt],
            ['URL', data.url],
            [translate(i18n, 'Website'), data.siteName]
        ].forEach(function (field) {
            var wrap = el(doc, 'div', 'border-bottom py-2');
            wrap.appendChild(el(doc, 'dt', 'small fw-bold text-uppercase text-muted mb-1', field[0]));
            var dd = el(doc, 'dd', 'small mb-0 text-break', field[1].value || translate(i18n, 'Missing'));
            dd.appendChild(el(doc, 'span', 'badge bg-light text-dark border ms-1 fw-normal', translate(i18n, field[1].source)));
            wrap.appendChild(dd);
            fields.appendChild(wrap);
        });
        inspector.appendChild(fields);
        var notes = {
            nostr: translate(i18n, 'The Nostr view is a representative client approximation, not a layout defined by the protocol.'),
            bluesky: translate(i18n, 'The preview shows the page data that a posting app can include in an external Bluesky embed; only the generated embed is authoritative.'),
            mastodon: translate(i18n, 'This view approximates a Mastodon preview card; the instance and client may render it differently.')
        };
        var note = notes[platform] || translate(i18n, 'This view is a local approximation. Platforms may change rendering, cropping, and text truncation depending on the client or context.');
        inspector.appendChild(el(doc, 'p', 'small text-muted mt-3 mb-0', note));
    }

    function mount(doc) {
        var button = doc.getElementById('social-media-previewer-button');
        if (!button || doc.getElementById('social-media-previewer-modal')) return;
        var i18n = readSeed(doc).i18n || {};

        var ui = el(doc, 'div', 'ccm-ui');
        var modal = el(doc, 'div', 'modal fade');
        modal.id = 'social-media-previewer-modal';
        modal.tabIndex = -1;
        modal.hidden = true;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', 'true');
        modal.setAttribute('aria-labelledby', 'smp-heading');
        modal.innerHTML = '<div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">' +
            '<div class="modal-content overflow-hidden">' +
            '<div class="modal-header"><h2 class="modal-title fs-5" id="smp-heading">Social media preview</h2><button type="button" class="btn-close" data-smp-close aria-label="Close"></button></div>' +
            '<div class="d-flex align-items-stretch border-bottom position-relative"><button type="button" class="btn btn-light rounded-0 border-0 border-end px-3 flex-shrink-0 fs-4" data-smp-previous aria-label="Previous platform">‹</button><div class="nav nav-tabs flex-wrap flex-grow-1 border-0 px-3" role="tablist" aria-label="Platforms"></div><button type="button" class="btn btn-light rounded-0 border-0 border-start px-3 flex-shrink-0 fs-4" data-smp-next aria-label="Next platform">›</button><span class="visually-hidden" aria-live="polite"></span></div>' +
            '<div class="modal-body p-0"><div class="smp-body row g-0"><div class="smp-stage col-12 col-lg-8 d-flex align-items-center justify-content-center p-4" id="smp-platform-panel" role="tabpanel"></div><aside class="smp-inspector col-12 col-lg-4 bg-white border-start p-4 overflow-auto"></aside></div></div>' +
            '</div></div>';
        var backdrop = el(doc, 'div', 'modal-backdrop fade');
        backdrop.hidden = true;
        backdrop.setAttribute('data-smp-close', '');
        ui.appendChild(modal);
        ui.appendChild(backdrop);
        doc.body.appendChild(ui);

        modal.querySelector('#smp-heading').textContent = translate(i18n, 'Social media preview');
        modal.querySelector('[data-smp-close]').setAttribute('aria-label', translate(i18n, 'Close'));
        modal.querySelector('[data-smp-previous]').setAttribute('aria-label', translate(i18n, 'Previous platform'));
        modal.querySelector('[role="tablist"]').setAttribute('aria-label', translate(i18n, 'Platforms'));
        modal.querySelector('[data-smp-next]').setAttribute('aria-label', translate(i18n, 'Next platform'));

        var active = 'x';
        var data = null;
        var names = {
            x: 'X',
            telegram: 'Telegram',
            facebook: 'Facebook',
            nostr: 'Nostr',
            linkedin: 'LinkedIn',
            bluesky: 'Bluesky',
            mastodon: 'Mastodon'
        };
        var tabs = modal.querySelector('[role="tablist"]');
        var stage = modal.querySelector('.smp-stage');
        var inspector = modal.querySelector('.smp-inspector');
        var position = modal.querySelector('.visually-hidden');
        var lastFocus = null;
        var swipeStart = null;
        var bodyWasModalOpen = false;

        function render(keepData, focusTab) {
            if (!keepData) data = collect(doc);
            tabs.replaceChildren();
            PLATFORMS.forEach(function (platform) {
                var problems = audit(data, platform, i18n).some(function (entry) { return entry.level === 'error' || entry.level === 'warning'; });
                var statusClass = problems ? ' text-danger' : ' text-success';
                var tab = el(doc, 'button', 'nav-link text-nowrap rounded-0 fw-semibold' + statusClass + (platform === active ? ' active' : ''));
                tab.type = 'button';
                tab.id = 'smp-tab-' + platform;
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-controls', 'smp-platform-panel');
                tab.setAttribute('aria-selected', platform === active ? 'true' : 'false');
                tab.setAttribute('aria-label', names[platform] + (problems ? ': ' + translate(i18n, 'check required') : ': ' + translate(i18n, 'no problems')));
                tab.title = problems ? translate(i18n, 'Check required') : translate(i18n, 'No problems found');
                tab.tabIndex = platform === active ? 0 : -1;
                tab.textContent = names[platform];
                tab.addEventListener('click', function () { active = platform; render(true, true); });
                tabs.appendChild(tab);
            });
            stage.setAttribute('aria-labelledby', 'smp-tab-' + active);
            position.textContent = names[active] + ', ' + (PLATFORMS.indexOf(active) + 1) + ' ' + translate(i18n, 'of') + ' ' + PLATFORMS.length;
            stage.replaceChildren();
            inspector.replaceChildren();
            renderCard(doc, stage, active, data, render, i18n);
            renderInspector(doc, inspector, active, data, i18n);
            var selectedTab = tabs.querySelector('[aria-selected="true"]');
            if (selectedTab) {
                if (focusTab) selectedTab.focus();
            }
        }

        function navigate(step, focusTab) {
            var current = PLATFORMS.indexOf(active);
            active = PLATFORMS[(current + step + PLATFORMS.length) % PLATFORMS.length];
            render(true, Boolean(focusTab));
        }

        function close() {
            modal.classList.remove('show');
            backdrop.classList.remove('show');
            modal.style.display = 'none';
            modal.hidden = true;
            backdrop.hidden = true;
            modal.setAttribute('aria-hidden', 'true');
            if (!bodyWasModalOpen) doc.body.classList.remove('modal-open');
            if (lastFocus) lastFocus.focus();
        }

        function open() {
            lastFocus = doc.activeElement;
            bodyWasModalOpen = doc.body.classList.contains('modal-open');
            render(false);
            modal.hidden = false;
            backdrop.hidden = false;
            modal.style.display = 'block';
            modal.setAttribute('aria-hidden', 'false');
            modal.classList.add('show');
            backdrop.classList.add('show');
            doc.body.classList.add('modal-open');
            modal.querySelector('.btn-close').focus();
        }

        button.addEventListener('click', function (event) {
            event.preventDefault();
            open();
        });
        modal.querySelector('[data-smp-previous]').addEventListener('click', function () { navigate(-1, false); });
        modal.querySelector('[data-smp-next]').addEventListener('click', function () { navigate(1, false); });
        tabs.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                navigate(event.key === 'ArrowLeft' ? -1 : 1, true);
            }
            if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                active = event.key === 'Home' ? PLATFORMS[0] : PLATFORMS[PLATFORMS.length - 1];
                render(true, true);
            }
        });
        stage.addEventListener('pointerdown', function (event) {
            if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
            swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
            if (stage.setPointerCapture) stage.setPointerCapture(event.pointerId);
        });
        stage.addEventListener('pointerup', function (event) {
            if (!swipeStart || swipeStart.id !== event.pointerId) return;
            var deltaX = event.clientX - swipeStart.x;
            var deltaY = event.clientY - swipeStart.y;
            swipeStart = null;
            if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
                navigate(deltaX < 0 ? 1 : -1, false);
            }
        });
        stage.addEventListener('pointercancel', function () { swipeStart = null; });
        ui.querySelectorAll('[data-smp-close]').forEach(function (node) { node.addEventListener('click', close); });
        modal.addEventListener('click', function (event) {
            if (event.target === modal) close();
        });
        modal.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') close();
            if (event.key === 'Tab') {
                var focusable = modal.querySelectorAll('button:not([disabled])');
                var firstNode = focusable[0];
                var lastNode = focusable[focusable.length - 1];
                if (event.shiftKey && doc.activeElement === firstNode) { event.preventDefault(); lastNode.focus(); }
                if (!event.shiftKey && doc.activeElement === lastNode) { event.preventDefault(); firstNode.focus(); }
            }
        });
    }

    return {
        clean: clean,
        first: first,
        absoluteUrl: absoluteUrl,
        hostname: hostname,
        audit: audit,
        collect: collect,
        mount: mount
    };
}));
