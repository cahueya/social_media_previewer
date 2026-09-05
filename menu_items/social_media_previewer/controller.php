<?php

namespace Concrete\Package\SocialMediaPreviewer\MenuItem\SocialMediaPreviewer;

defined('C5_EXECUTE') or die('Access Denied.');

use Concrete\Core\Application\UserInterface\Menu\Item\Controller as MenuItemController;
use Concrete\Core\Page\Page;
use Concrete\Core\Page\View\PageView;

class Controller extends MenuItemController
{
    public function displayItem()
    {
        $page = Page::getCurrentPage();

        return $this->isPreviewablePage($page);
    }

    public function registerViewAssets()
    {
        $page = Page::getCurrentPage();
        if (!$this->isPreviewablePage($page)) {
            return;
        }

        $view = PageView::getInstance();
        $view->requireAsset('css', 'social-media-previewer');
        $view->requireAsset('javascript', 'social-media-previewer');
        $view->addFooterItem($this->buildPageSeed($page));
    }

    private function isPreviewablePage($page): bool
    {
        if (!$page || $page->isError()) {
            return false;
        }

        $path = (string) $page->getCollectionPath();

        return $path !== '/dashboard' && strpos($path, '/dashboard/') !== 0;
    }

    private function buildPageSeed($page): string
    {
        $thumbnail = $page->getAttribute('thumbnail');
        $thumbnailUrl = '';

        if (is_string($thumbnail)) {
            $thumbnailUrl = $thumbnail;
        } elseif (is_object($thumbnail)) {
            if (method_exists($thumbnail, 'getURL')) {
                $thumbnailUrl = (string) $thumbnail->getURL();
            } elseif (method_exists($thumbnail, 'getVersion')) {
                $version = $thumbnail->getVersion();
                if ($version && method_exists($version, 'getURL')) {
                    $thumbnailUrl = (string) $version->getURL();
                }
            } elseif (method_exists($thumbnail, 'getApprovedVersion')) {
                $version = $thumbnail->getApprovedVersion();
                if ($version && method_exists($version, 'getURL')) {
                    $thumbnailUrl = (string) $version->getURL();
                }
            }
        }

        $data = [
            'pageId' => (int) $page->getCollectionID(),
            'name' => (string) $page->getCollectionName(),
            'description' => (string) $page->getCollectionDescription(),
            'metaTitle' => (string) $page->getAttribute('meta_title'),
            'metaDescription' => (string) $page->getAttribute('meta_description'),
            'thumbnail' => $thumbnailUrl,
            'i18n' => $this->getTranslations(),
        ];

        $json = json_encode(
            $data,
            JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );

        return '<script type="application/json" id="social-media-previewer-page-data">' . $json . '</script>';
    }

    private function getTranslations(): array
    {
        $messages = [
            'Social media preview',
            'Close',
            'Previous platform',
            'Next platform',
            'Platforms',
            'Check required',
            'No problems found',
            'check required',
            'no problems',
            'of',
            'Check',
            'Data used',
            'Title',
            'Description',
            'Image',
            'Image alt text',
            'Website',
            'Missing',
            'missing',
            'current URL',
            'first H1',
            'Concrete page name',
            'Concrete page description',
            'first paragraph',
            'first content image',
            'domain',
            'default value',
            'image alt text',
            'preview default',
            'The image could not be loaded',
            'No preview image',
            'Title is missing.',
            'Description is missing; the card will appear incomplete.',
            'Preview image is missing.',
            'Canonical URL is missing.',
            'The image URL is not an absolute HTTP(S) URL.',
            'twitter:card is missing; X may fall back to Open Graph, but the result is less predictable.',
            'twitter:card contains an unknown value.',
            'App and player cards are approximated as link cards; embedded app or player features are not executed locally.',
            'An aspect ratio close to 2:1 is recommended for summary_large_image.',
            'The X image is smaller than 300 × 157 px.',
            'The X thumbnail is smaller than 144 × 144 px.',
            'og:title is missing; the current preview only uses a local fallback.',
            'og:image is missing; the current preview only uses a local fallback.',
            'og:url is missing; the current preview only uses the canonical or page URL locally.',
            'og:type is missing; the local preview assumes “website”.',
            'An aspect ratio of about 1.91:1 (for example 1200 × 630 px) is recommended for large Facebook cards.',
            'Facebook requires an image of at least 200 × 200 px.',
            'Telegram generates link previews server-side; complete Open Graph data makes the result more predictable.',
            'Nostr does not define a single link-card layout; rendering and Open Graph processing vary by client.',
            'LinkedIn expects og:title; the current preview only uses a local fallback.',
            'LinkedIn expects og:image; the current preview only uses a local fallback.',
            'LinkedIn expects og:description; the current preview only uses a local fallback.',
            'LinkedIn expects og:url; the current preview only uses the canonical or page URL locally.',
            'LinkedIn recommends an aspect ratio of 1.91:1 for large cards.',
            'The LinkedIn image is smaller than the recommended minimum size of 1200 × 627 px.',
            'Incomplete Open Graph data may prevent a Bluesky app from creating a complete card automatically.',
            'Bluesky stores the title, description, URL, and optional thumbnail as an external embed in the post; the posting app therefore determines the final card data.',
            'Mastodon generates preview cards from Open Graph; incomplete og: data may result in a reduced card.',
            'Layout, text truncation, and retrieval timing may vary by Mastodon client and instance.',
            'Alternative text for the preview image is missing.',
            'All data relevant to this local check is present.',
            'The Nostr view is a representative client approximation, not a layout defined by the protocol.',
            'The preview shows the page data that a posting app can include in an external Bluesky embed; only the generated embed is authoritative.',
            'This view approximates a Mastodon preview card; the instance and client may render it differently.',
            'This view is a local approximation. Platforms may change rendering, cropping, and text truncation depending on the client or context.',
        ];
        $translations = [];

        foreach ($messages as $message) {
            $translations[$message] = t($message);
        }

        return $translations;
    }
}
