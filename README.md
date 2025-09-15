> **Note:** This is a personal fork of the official [`hexojs/hexo-generator-feed`](https://github.com/hexojs/hexo-generator-feed). It includes additional features for feed beautification and content processing.

# hexo-generator-feed

Generate an Atom 1.0 or RSS 2.0 feed for your Hexo blog, with powerful added features.

## New Features in this Version

* **XSLT Stylesheet for Browser Preview:** Apply a custom XSL stylesheet to your XML feed, transforming the raw XML into a beautiful, human-readable HTML preview when opened directly in a browser.
* **Configurable Code Block Line Number Stripping:** Automatically remove line numbers from highlighted code blocks *only* within your feed content. This provides a clean, copy-paste-friendly experience in RSS readers without affecting the appearance of your main website.

## Install

To install this specific version from your GitHub repository, run the following command in your Hexo project's root directory.

``` bash
npm install Cytrogen/hexo-generator-feed --save
```

After installation, your `package.json` will contain a dependency pointing directly to your repository.

## Use

In the [front-matter](https://hexo.io/docs/front-matter.html) of your post, you can optionally add a `description`, `intro` or `excerpt` setting to write a summary for the post. Otherwise the summary will default to the excerpt or the first 140 characters of the post.

## Options

You can configure this plugin in `_config.yml`.

``` yaml
feed:
  enable: true
  type: atom
  path: atom.xml
  limit: 20
  hub:
  content:
  content_limit: 140
  content_limit_delim: ' '
  order_by: -date
  icon: icon.png
  autodiscovery: true
  template:
  # New options below
  stylesheet: /feed.xsl
  strip_code_line_numbers: true
```
- **enable** - Enables or disables this plugin. Enabled by default.
- **type** - Feed type. `atom` or `rss2`. Specify `['atom', 'rss2']` to output both types. (Default: `atom`)
  * Example:
  ``` yaml
  feed:
    # Generate atom feed
    type: atom

    # Generate both atom and rss2 feeds
    type:
      - atom
      - rss2
    path:
      - atom.xml
      - rss2.xml
  ```
- **path** - Feed path. When both types are specified, path must follow the order of type value. (Default: atom.xml/rss2.xml)
- **limit** - Maximum number of posts in the feed (Use `0` or `false` to show all posts)
- **hub** - URL of the PubSubHubbub hubs (Leave it empty if you don't use it)
- **content** - (optional) set to 'true' to include the contents of the entire post in the feed.
- **content_limit** - (optional) Default length of post content used in summary. Only used, if **content** setting is false and no custom post description present.
- **content_limit_delim** - (optional) If **content_limit** is used to shorten post contents, only cut at the last occurrence of this delimiter before reaching the character limit. Not used by default.
- **order_by** - Feed order-by. (Default: -date)
- **icon** - (optional) Custom feed icon. Defaults to a gravatar of email specified in the main config.
- **autodiscovery** - Add feed [autodiscovery](https://www.rssboard.org/rss-autodiscovery). (Default: `true`)
  * Many themes already offer this feature, so you may also need to adjust the theme's config if you wish to disable it.
- **template** - Custom template path(s). This file will be used to generate feed xml file, see the default templates: [atom.xml](atom.xml) and [rss2.xml](rss2.xml).
  * It is possible to specify just one custom template, even when this plugin is configured to output both feed types,
  ``` yaml
  # (Optional) Exclude custom template from being copied into public/ folder
  # Alternatively, you could also prepend an underscore to its filename, e.g. _custom.xml
  # https://hexo.io/docs/configuration#Include-Exclude-Files-or-Folders
  exclude:
    - 'custom.xml'
  feed:
    type:
      - atom
      - rss2
    template:
      - ./source/custom.xml
    # atom will be generated using custom.xml
    # rss2 will be generated using the default template instead
  ```
- **stylesheet** - (New Feature) Path to an XSL stylesheet to apply to the feed for in-browser presentation. The path should be relative to your site's root (e.g., place `feed.xsl` in your `source` directory).
- **strip_code_line_numbers** - (New Feature) Set to `true` to automatically remove the line number table from highlighted code blocks within the feed's content. (Default: `false`)