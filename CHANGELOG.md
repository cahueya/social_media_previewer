## [1.5.0] – 2026-09-05

### Added

* Added complete German (`de_DE`), French (`fr_FR`), and Italian (`it_IT`) translations.
* Added editable PO catalogs and compiled MO files for all supported languages.
* Added a Concrete CMS-compatible 97 × 97 px package icon.
* Added the MIT license file and declared the license in `package.json`.
* Added automated checks for the package icon, translations, license, and dashboard exclusion.

### Changed

* Converted all source and interface strings to English.
* Updated the README in English and documented the available translations.
* Reworked the interface to use Bootstrap and Concrete CMS `.ccm-ui` components wherever possible.
* Limited custom CSS to platform-specific preview cards, preview dimensions, and swipe handling.
* Replaced numbered platform badges with success and danger status indicators.
* Platform tabs now show whether attention is required without displaying issue counts.
* Improved tab wrapping so the platform selector no longer requires horizontal scrollbars.
* Detailed errors and warnings remain available in each platform’s **Check** view.
* Removed the secondary status text from the modal header.
* Removed unnecessary top padding from the platform navigation.
* Restricted the preview feature to frontend pages.

### Fixed

* The toolbar item and its CSS and JavaScript assets are no longer loaded on `/dashboard` or any path below `/dashboard/`.
* Removed redundant custom interface styles already provided by Bootstrap.
* Prevented the platform navigation from appearing cramped or producing unnecessary horizontal scrolling.
* Ensured translated JavaScript messages are supplied through Concrete CMS rather than being hard-coded in the script.
