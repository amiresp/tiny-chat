function text(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || '';
}

function firstByTag(node, names) {
  for (const name of names) {
    const item = node.getElementsByTagName(name)?.[0];
    if (item) return item;
  }
  return null;
}

function cleanHtml(value) {
  if (!value) return '';
  const documentValue = new DOMParser().parseFromString(value, 'text/html');
  return documentValue.body.textContent?.trim() || '';
}

function rssItem(item, index) {
  const enclosure = item.querySelector('enclosure');
  const media = firstByTag(item, ['media:content', 'media:thumbnail']);
  const rawDescription = text(item, 'description') || text(item, 'content\\:encoded');
  const dateValue = text(item, 'pubDate') || text(item, 'date') || new Date().toISOString();

  return {
    id: text(item, 'guid') || text(item, 'link') || `rss-${index}`,
    type: 'rss',
    title: text(item, 'title') || 'Untitled article',
    body: cleanHtml(rawDescription),
    link: text(item, 'link'),
    author: text(item, 'author') || text(item, 'dc\\:creator'),
    imageUrl: enclosure?.getAttribute('url') || media?.getAttribute('url') || null,
    imageType: enclosure?.getAttribute('type') || media?.getAttribute('type') || null,
    createdAt: dateValue,
  };
}

function atomEntry(entry, index) {
  const linkNode = [...entry.querySelectorAll('link')]
    .find((item) => !item.getAttribute('rel') || item.getAttribute('rel') === 'alternate');
  const media = firstByTag(entry, ['media:content', 'media:thumbnail']);
  const rawDescription = text(entry, 'summary') || text(entry, 'content');

  return {
    id: text(entry, 'id') || linkNode?.getAttribute('href') || `atom-${index}`,
    type: 'rss',
    title: text(entry, 'title') || 'Untitled article',
    body: cleanHtml(rawDescription),
    link: linkNode?.getAttribute('href') || '',
    author: text(entry, 'author > name') || text(entry, 'author'),
    imageUrl: media?.getAttribute('url') || null,
    imageType: media?.getAttribute('type') || null,
    createdAt: text(entry, 'published') || text(entry, 'updated') || new Date().toISOString(),
  };
}

export async function loadRssFeed(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5',
      },
    });
  } catch {
    throw new Error('The RSS server blocked browser access (CORS) or is unavailable.');
  }

  if (!response.ok) {
    throw new Error(`RSS server returned HTTP ${response.status}`);
  }

  const xml = await response.text();
  const documentValue = new DOMParser().parseFromString(xml, 'application/xml');
  if (documentValue.querySelector('parsererror')) {
    throw new Error('The URL did not return valid RSS or Atom XML.');
  }

  const rssItems = [...documentValue.querySelectorAll('channel > item')];
  const atomItems = [...documentValue.querySelectorAll('feed > entry')];
  const items = rssItems.length
    ? rssItems.map(rssItem)
    : atomItems.map(atomEntry);

  return {
    title: text(documentValue, 'channel > title') || text(documentValue, 'feed > title'),
    items: items.slice(0, 100),
  };
}
