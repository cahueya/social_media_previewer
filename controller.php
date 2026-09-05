<?php

namespace Concrete\Package\SocialMediaPreviewer;

defined('C5_EXECUTE') or die('Access Denied.');

use Concrete\Core\Asset\Asset;
use Concrete\Core\Asset\AssetList;
use Concrete\Core\Package\Package;

class Controller extends Package
{
    protected $pkgHandle = 'social_media_previewer';
    protected $appVersionRequired = '9.0.0';
    protected $pkgVersion = '1.5.0';

    public function getPackageName()
    {
        return t('Social Media Previewer');
    }

    public function getPackageDescription()
    {
        return t('Previews the current page for X, Telegram, Facebook, Nostr, LinkedIn, Bluesky and Mastodon before publishing.');
    }

    public function on_start()
    {
        $assets = AssetList::getInstance();
        $assets->register(
            'css',
            'social-media-previewer',
            'css/social-media-previewer.css',
            ['version' => $this->pkgVersion],
            $this
        );
        $assets->register(
            'javascript',
            'social-media-previewer',
            'js/social-media-previewer.js',
            [
                'version' => $this->pkgVersion,
                'position' => Asset::ASSET_POSITION_FOOTER,
            ],
            $this
        );

        $menu = $this->app->make('helper/concrete/ui/menu');
        $menu->addPageHeaderMenuItem('social_media_previewer', $this->pkgHandle, [
            'icon' => 'far fa-eye',
            'label' => t('Social Media Preview'),
            'position' => 'right',
            'href' => '#social-media-previewer-modal',
            'linkAttributes' => [
                'id' => 'social-media-previewer-button',
                'role' => 'button',
                'aria-haspopup' => 'dialog',
                'title' => t('Preview this page for social media'),
            ],
        ]);
    }
}
