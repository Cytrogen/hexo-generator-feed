'use strict';

const nunjucks = require('nunjucks');
const env = new nunjucks.Environment();
const { join } = require('path');
const { readFileSync } = require('fs');
const { encodeURL, gravatar, full_url_for } = require('hexo-util');
const cheerio = require('cheerio');

env.addFilter('uriencode', str => {
  return encodeURL(str);
});

env.addFilter('noControlChars', str => {
  return str.replace(/[\x00-\x1F\x7F]/g, ''); // eslint-disable-line no-control-regex
});

/**
 * Uses Cheerio to robustly remove line numbers from Hexo's code blocks.
 * @param {string} content The HTML content of a post.
 * @returns {string} The cleaned HTML content.
 */
function stripLineNumbersFromContent(content) {
  if (!content) return content;

  const $ = cheerio.load(content, {
    decodeEntities: false,
    lowerCaseAttributeNames: false
  });

  $('figure.highlight').each(function() {
    const $figure = $(this);
    const $table = $figure.find('table');
    
    if ($table.length > 0) {
      const $codeLines = $table.find('td.code .line');
      const codeText = $codeLines.map(function() {
        return $(this).text();
      }).get().join('\n');
      
      const $newPre = $('<pre></pre>');
      const $newCode = $('<code></code>');
      
      const figureClasses = $figure.attr('class') || '';
      const languageMatch = figureClasses.match(/highlight\s+(\w+)/);
      if (languageMatch) {
        $newCode.addClass(`language-${languageMatch[1]}`);
      }
      
      $newCode.text(codeText);
      $newPre.append($newCode);
      
      $figure.replaceWith($newPre);
    }
  });

  return $.html();
}

module.exports = function(locals, type, path) {
  const { config } = this;
  const { email, feed, url: urlCfg } = config;
  const { icon: iconCfg, limit, order_by, template: templateCfg, type: typeCfg } = feed;

  env.addFilter('formatUrl', str => {
    return full_url_for.call(this, str);
  });

  let tmplSrc = join(__dirname, `../${type}.xml`);
  if (templateCfg) {
    if (typeof templateCfg === 'string') tmplSrc = templateCfg;
    else tmplSrc = templateCfg[typeCfg.indexOf(type)];
  }
  const template = nunjucks.compile(readFileSync(tmplSrc, 'utf8'), env);

  let posts = locals.posts.sort(order_by || '-date');
  posts = posts.filter(post => {
    return post.draft !== true;
  });

  if (posts.length <= 0) {
    feed.autodiscovery = false;
    return;
  }

  if (limit) posts = posts.limit(limit);

  let postsForFeed = posts;
  if (feed && feed.strip_code_line_numbers) {
    postsForFeed = posts.map(post => {
      const postForFeed = Object.create(post);
      postForFeed.content = stripLineNumbersFromContent(post.content);
      return postForFeed;
    });
  }

  let url = urlCfg;
  if (url[url.length - 1] !== '/') url += '/';

  let icon = '';
  if (iconCfg) icon = full_url_for.call(this, iconCfg);
  else if (email) icon = gravatar(email);

  const feed_url = full_url_for.call(this, path);

  const data = template.render({
    config,
    url,
    icon,
    posts,
    feed_url
  });

  return {
    path,
    data
  };
};
