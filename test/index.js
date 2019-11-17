'use strict';

require('chai').should();
const Hexo = require('hexo');
const nunjucks = require('nunjucks');
const env = new nunjucks.Environment();
const { join } = require('path');
const { readFileSync } = require('fs');
const cheerio = require('cheerio');
const { encodeURL, full_url_for } = require('hexo-util');

env.addFilter('uriencode', str => {
  return encodeURI(str);
});

env.addFilter('noControlChars', str => {
  return str.replace(/[\x00-\x1F\x7F]/g, ''); // eslint-disable-line no-control-regex
});

const atomTmplSrc = join(__dirname, '../atom.xml');
const atomTmpl = nunjucks.compile(readFileSync(atomTmplSrc, 'utf8'), env);
const rss2TmplSrc = join(__dirname, '../rss2.xml');
const rss2Tmpl = nunjucks.compile(readFileSync(rss2TmplSrc, 'utf8'), env);

const urlConfig = {
  url: 'http://localhost/',
  root: '/'
};

describe('Feed generator', () => {
  const hexo = new Hexo(__dirname, {
    silent: true
  });
  const Post = hexo.model('Post');
  const generator = require('../lib/generator').bind(hexo);

  require('../node_modules/hexo/lib/plugins/helper')(hexo);

  let posts = {};
  let locals = {};

  before(() => {
    return Post.insert([
      {source: 'foo', slug: 'foo', content: '<h6>TestHTML</h6>', date: 1e8},
      {source: 'bar', slug: 'bar', date: 1e8 + 1},
      {source: 'baz', slug: 'baz', title: 'With Image', image: 'test.png', date: 1e8 - 1}
    ]).then(data => {
      posts = Post.sort('-date');
      locals = hexo.locals.toObject();
    });
  });

  it('type = atom', () => {
    hexo.config.feed = {
      type: 'atom',
      path: 'atom.xml',
      limit: 3
    };
    hexo.config = Object.assign(hexo.config, urlConfig);
    const feedCfg = hexo.config.feed;
    const result = generator(locals, feedCfg.type, feedCfg.path);

    result.path.should.eql('atom.xml');
    result.data.should.eql(atomTmpl.render({
      config: hexo.config,
      url: urlConfig.url,
      posts: posts.limit(3),
      feed_url: hexo.config.root + 'atom.xml'
    }));
  });

  it('type = rss2', () => {
    hexo.config.feed = {
      type: 'rss2',
      path: 'rss2.xml',
      limit: 3
    };
    hexo.config = Object.assign(hexo.config, urlConfig);
    const feedCfg = hexo.config.feed;
    const result = generator(locals, feedCfg.type, feedCfg.path);

    result.path.should.eql('rss2.xml');
    result.data.should.eql(rss2Tmpl.render({
      config: hexo.config,
      url: urlConfig.url,
      posts: posts.limit(3),
      feed_url: hexo.config.root + 'rss2.xml'
    }));
  });

  it('limit = 0', () => {
    hexo.config.feed = {
      type: 'atom',
      path: 'atom.xml',
      limit: 0
    };
    hexo.config = Object.assign(hexo.config, urlConfig);
    const feedCfg = hexo.config.feed;
    const result = generator(locals, feedCfg.type, feedCfg.path);

    result.path.should.eql('atom.xml');
    result.data.should.eql(atomTmpl.render({
      config: hexo.config,
      url: urlConfig.url,
      posts: posts,
      feed_url: hexo.config.root + 'atom.xml'
    }));
  });

  it('Preserves HTML in the content field', () => {
    hexo.config.feed = {
      type: 'rss2',
      path: 'rss2.xml',
      content: true
    };
    let feedCfg = hexo.config.feed;
    let result = generator(locals, feedCfg.type, feedCfg.path);
    let $ = cheerio.load(result.data, {xmlMode: true});

    let description = $('content\\:encoded').html()
      .replace(/^<!\[CDATA\[/, '')
      .replace(/\]\]>$/, '');

    description.should.be.equal('<h6>TestHTML</h6>');

    hexo.config.feed = {
      type: 'atom',
      path: 'atom.xml',
      content: true
    };
    feedCfg = hexo.config.feed;
    result = generator(locals, feedCfg.type, feedCfg.path);
    $ = cheerio.load(result.data, {xmlMode: true});
    description = $('content[type="html"]').html()
      .replace(/^<!\[CDATA\[/, '')
      .replace(/\]\]>$/, '');

    description.should.be.equal('<h6>TestHTML</h6>');

  });

  it('Relative URL handling', () => {
    hexo.config.feed = {
      type: 'atom',
      path: 'atom.xml'
    };

    const checkURL = function(url, root, valid) {
      hexo.config.url = url;
      hexo.config.root = root;

      const feedCfg = hexo.config.feed;
      const result = generator(locals, feedCfg.type, feedCfg.path);
      const $ = cheerio.load(result.data);

      $('feed>id').text().should.eql(valid);
    };

    checkURL('http://localhost/', '/', 'http://localhost/');

    const GOOD = 'http://localhost/blog/';

    checkURL('http://localhost/blog', '/blog/', GOOD);
    checkURL('http://localhost/blog', '/blog', GOOD);
    checkURL('http://localhost/blog/', '/blog/', GOOD);
    checkURL('http://localhost/blog/', '/blog', GOOD);

    checkURL('http://localhost/b/l/o/g', '/', 'http://localhost/b/l/o/g/');

  });

  it('IDN handling', () => {
    hexo.config.feed = {
      type: 'atom',
      path: 'atom.xml'
    };

    const checkURL = function(url, root) {
      hexo.config.url = url;
      hexo.config.root = root;

      const feedCfg = hexo.config.feed;
      const result = generator(locals, feedCfg.type, feedCfg.path);
      const $ = cheerio.load(result.data);

      if (url[url.length - 1] !== '/') url += '/';
      const punyIDN = encodeURL(url);
      $('feed>id').text().should.eql(punyIDN);
    };

    checkURL('http://gôg.com/', '/');

    checkURL('http://gôg.com/bár', '/bár/');
  });

  it('Root encoding', () => {
    const file = 'atom.xml';
    hexo.config.feed = {
      type: 'atom',
      path: file
    };

    const domain = 'http://example.com/';

    const checkURL = function(root, valid) {
      hexo.config.url = domain;
      hexo.config.root = root;

      const feedCfg = hexo.config.feed;
      const result = generator(locals, feedCfg.type, feedCfg.path);
      const $ = cheerio.load(result.data);

      $('feed>link').attr('href').should.eql(valid);
    };
    checkURL('/', '/' + file);

    checkURL('blo g/', 'blo%20g/' + file);
  });

  it('Prints an enclosure on `image` metadata', () => {
    hexo.config.feed = {
      type: 'atom',
      path: 'atom.xml'
    };

    const checkURL = function(url, root, selector) {
      hexo.config.url = url;
      hexo.config.root = root;

      const feedCfg = hexo.config.feed;
      const result = generator(locals, feedCfg.type, feedCfg.path);
      const $ = cheerio.load(result.data);

      $(selector).length.should.eq(1);
    };

    checkURL('http://localhost/', '/', 'feed>entry:nth-of-type(3)>content[type="image"]');

    hexo.config.feed = {
      type: 'rss2',
      path: 'rss2.xml',
      content: true
    };
    checkURL('http://localhost/', '/', 'item:nth-of-type(3)>enclosure');
  });

  it('Icon (atom)', () => {
    hexo.config.url = 'http://example.com';
    hexo.config.root = '/';

    hexo.config.feed = {
      type: 'atom',
      path: 'atom.xml',
      icon: 'icon.svg'
    };

    const feedCfg = hexo.config.feed;
    const result = generator(locals, feedCfg.type, feedCfg.path);
    const $ = cheerio.load(result.data);

    $('feed>icon').text().should.eql(full_url_for.call(hexo, hexo.config.feed.icon));
  });

  it('Icon (atom) - no icon', () => {
    hexo.config.feed = {
      type: 'atom',
      path: 'atom.xml',
      icon: undefined
    };

    const feedCfg = hexo.config.feed;
    const result = generator(locals, feedCfg.type, feedCfg.path);
    const $ = cheerio.load(result.data);

    $('feed>icon').length.should.eql(0);
  });

  it('Icon (rss2)', () => {
    hexo.config.url = 'http://example.com';
    hexo.config.root = '/';

    hexo.config.feed = {
      type: 'rss2',
      path: 'rss2.xml',
      icon: 'icon.svg'
    };

    const feedCfg = hexo.config.feed;
    const result = generator(locals, feedCfg.type, feedCfg.path);
    const $ = cheerio.load(result.data);

    $('rss>channel>image>url').text().should.eql(full_url_for.call(hexo, hexo.config.feed.icon));
  });

  it('Icon (rss2) - no icon', () => {
    hexo.config.feed = {
      type: 'rss2',
      path: 'rss2.xml',
      icon: undefined
    };

    const feedCfg = hexo.config.feed;
    const result = generator(locals, feedCfg.type, feedCfg.path);
    const $ = cheerio.load(result.data);

    $('rss>channel>image').length.should.eql(0);
  });

  it('path must follow order of type', () => {
    hexo.config.feed = {
      type: ['rss2', 'atom'],
      path: ['rss-awesome.xml', 'atom-awesome.xml']
    };
    hexo.config = Object.assign(hexo.config, urlConfig);

    const feedCfg = hexo.config.feed;
    const rss = generator(locals, feedCfg.type[0], feedCfg.path[0]);
    rss.path.should.eql(hexo.config.feed.path[0]);

    const atom = generator(locals, feedCfg.type[1], feedCfg.path[1]);
    atom.path.should.eql(hexo.config.feed.path[1]);
  });
});

it('No posts', () => {
  const hexo = new Hexo(__dirname, {
    silent: true
  });
  const Post = hexo.model('Post');
  const generator = require('../lib/generator').bind(hexo);

  require('../node_modules/hexo/lib/plugins/helper')(hexo);

  hexo.config.feed = {
    type: 'atom',
    path: 'atom.xml'
  };
  hexo.config = Object.assign(hexo.config, urlConfig);
  const feedCfg = hexo.config.feed;

  return Post.insert([]).then(data => {
    const locals = hexo.locals.toObject();
    const result = typeof generator(locals, feedCfg.type, feedCfg.path);

    result.should.eql('undefined');
  });
});

describe('Autodiscovery', () => {
  const hexo = new Hexo();
  const autoDiscovery = require('../lib/autodiscovery').bind(hexo);
  hexo.config = {
    title: 'foo',
    root: '/'
  };
  hexo.config.feed = {
    type: ['atom'],
    path: ['atom.xml'],
    autodiscovery: true
  };
  hexo.config = Object.assign(hexo.config, urlConfig);

  it('default', () => {
    const content = '<head><link></head>';
    const result = autoDiscovery(content).trim();

    const $ = cheerio.load(result);
    $('link[type="application/atom+xml"]').length.should.eql(1);
    $('link[type="application/atom+xml"]').attr('href').should.eql(urlConfig.root + hexo.config.feed.path);
    $('link[type="application/atom+xml"]').attr('title').should.eql(hexo.config.title);
  });

  it('disable', () => {
    hexo.config.feed.autodiscovery = false;
    const content = '<head><link></head>';
    const result = autoDiscovery(content);

    const resultType = typeof result;
    resultType.should.eql('undefined');

    hexo.config.feed.autodiscovery = true;
  });

  it('prepend root', () => {
    hexo.config.root = '/root/';
    const content = '<head><link></head>';
    const result = autoDiscovery(content);

    const $ = cheerio.load(result);
    $('link[type="application/atom+xml"]').attr('href').should.eql(hexo.config.root + hexo.config.feed.path);

    hexo.config.root = '/';
  });

  it('no duplicate tag', () => {
    const content = '<head><link>'
      + '<link rel="alternate" href="/atom.xml" title="foo" type="application/atom+xml"></head>';
    const result = autoDiscovery(content);

    const resultType = typeof result;
    resultType.should.eql('undefined');
  });

  it('ignore empty head tag', () => {
    const content = '<head></head>'
      + '<head><link></head>'
      + '<head></head>';
    const result = autoDiscovery(content);

    const $ = cheerio.load(result);
    $('link[type="application/atom+xml"]').length.should.eql(1);
  });

  it('apply to first non-empty head tag only', () => {
    const content = '<head></head>'
      + '<head><link></head>'
      + '<head><link></head>';
    const result = autoDiscovery(content);

    const $ = cheerio.load(result);
    $('link[type="application/atom+xml"]').length.should.eql(1);
  });

  it('rss2', () => {
    hexo.config.feed = {
      type: ['rss2'],
      path: ['rss2.xml']
    };
    const content = '<head><link></head>';
    const result = autoDiscovery(content);

    const $ = cheerio.load(result);
    $('link[rel="alternate"]').attr('type').should.eql('application/rss+xml');

    hexo.config.feed = {
      type: ['atom'],
      path: ['atom.xml']
    };
  });

  it('multi-line head tag', () => {
    const content = '<head>\n<link>\n</head>';
    const result = autoDiscovery(content);

    const $ = cheerio.load(result);
    $('link[rel="alternate"]').length.should.eql(1);
  });

  it('atom + rss2', () => {
    hexo.config.feed = {
      type: ['atom', 'rss2'],
      path: ['atom.xml', 'rss2.xml']
    };
    hexo.config = Object.assign(hexo.config, urlConfig);

    const content = '<head><link></head>';
    const result = autoDiscovery(content);

    const $ = cheerio.load(result);
    $('link[rel="alternate"]').length.should.eql(2);
    $('link[rel="alternate"]').eq(0).attr('type').should.eql('application/atom+xml');
    $('link[rel="alternate"]').eq(1).attr('type').should.eql('application/rss+xml');
  });
});
