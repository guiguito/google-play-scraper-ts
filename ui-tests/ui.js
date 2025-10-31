const output = document.getElementById('output');
const niceViewEl = document.getElementById('nice-view');
const tabsEl = document.getElementById('tabs');
const formsEl = document.getElementById('forms');
const proxyPanel = document.getElementById('proxy-panel');

const meta = await fetch('/meta').then((res) => res.json());
let proxyStatus = meta.proxy ?? { enabled: false };

const selectFrom = (record) => Object.entries(record).map(([key, value]) => ({ label: key, value }));

const formConfigs = [
  {
    id: 'app',
    label: 'app()',
    description: 'Fetch full details for a single application.',
    fields: [
      { name: 'appId', label: 'App ID', placeholder: 'com.spotify.music', required: true },
      { name: 'lang', label: 'Language', value: 'en' },
      { name: 'country', label: 'Country', value: 'us' }
    ],
  },
  {
    id: 'list',
    label: 'list()',
    description: 'Retrieve a top collection (optionally full detail).',
    fields: [
      { name: 'collection', label: 'Collection', type: 'select', options: selectFrom(meta.constants.collection) },
      { name: 'category', label: 'Category', type: 'select', options: selectFrom(meta.constants.category) },
      { name: 'num', label: 'Limit', type: 'number', value: 20 },
      { name: 'fullDetail', label: 'Return full detail', type: 'checkbox' },
      { name: 'lang', label: 'Language', value: 'en' },
      { name: 'country', label: 'Country', value: 'us' }
    ],
    convert(values) {
      return { ...values, num: Number(values.num), fullDetail: Boolean(values.fullDetail) };
    },
  },
  {
    id: 'search',
    label: 'search()',
    description: 'Search the Play Store.',
    fields: [
      { name: 'term', label: 'Term', placeholder: 'podcast', required: true },
      { name: 'num', label: 'Limit', type: 'number', value: 20 },
      { name: 'price', label: 'Price', type: 'select', options: [
        { label: 'all', value: 'all' },
        { label: 'free', value: 'free' },
        { label: 'paid', value: 'paid' }
      ] },
      {
        name: 'mode',
        label: 'Result source',
        type: 'select',
        value: 'modern',
        options: [
          { label: 'Default (/store/search)', value: 'modern' },
          { label: 'Legacy global (/work/search)', value: 'global' }
        ]
      },
      { name: 'fullDetail', label: 'Return full detail', type: 'checkbox' },
      { name: 'lang', label: 'Language', value: 'en' },
      { name: 'country', label: 'Country', value: 'us' }
    ],
    convert(values) {
      return {
        ...values,
        num: Number(values.num),
        fullDetail: Boolean(values.fullDetail),
        mode: values.mode || 'modern',
      };
    },
  },
  {
    id: 'suggest',
    label: 'suggest()',
    description: 'Get search suggestions.',
    fields: [
      { name: 'term', label: 'Term', placeholder: 'twit', required: true },
      { name: 'lang', label: 'Language', value: 'en' },
      { name: 'country', label: 'Country', value: 'us' }
    ],
  },
  {
    id: 'developer',
    label: 'developer()',
    description: 'List apps from a developer.',
    fields: [
      { name: 'devId', label: 'Developer ID', placeholder: 'Spotify AB', required: true },
      { name: 'num', label: 'Limit', type: 'number', value: 30 },
      { name: 'fullDetail', label: 'Return full detail', type: 'checkbox' },
      { name: 'lang', label: 'Language', value: 'en' },
      { name: 'country', label: 'Country', value: 'us' }
    ],
    convert(values) {
      return { ...values, num: Number(values.num), fullDetail: Boolean(values.fullDetail) };
    },
  },
  {
    id: 'reviews',
    label: 'reviews()',
    description: 'Fetch user reviews (auto-pagination when needed).',
    fields: [
      { name: 'appId', label: 'App ID', placeholder: 'com.spotify.music', required: true },
      { name: 'num', label: 'Limit', type: 'number', value: 20 },
      { name: 'sort', label: 'Sort', type: 'select', options: selectFrom(meta.constants.sort) },
      { name: 'lang', label: 'Language', value: 'en' },
      { name: 'country', label: 'Country', value: 'us' }
    ],
    convert(values) {
      return { ...values, num: Number(values.num), sort: Number(values.sort) };
    },
  },
  {
    id: 'similar',
    label: 'similar()',
    description: 'Discover similar apps.',
    fields: [
      { name: 'appId', label: 'App ID', placeholder: 'com.spotify.music', required: true },
      { name: 'fullDetail', label: 'Return full detail', type: 'checkbox' },
      { name: 'lang', label: 'Language', value: 'en' },
      { name: 'country', label: 'Country', value: 'us' }
    ],
    convert(values) {
      return { ...values, fullDetail: Boolean(values.fullDetail) };
    },
  },
  {
    id: 'permissions',
    label: 'permissions()',
    description: 'List permissions required by an app.',
    fields: [
      { name: 'appId', label: 'App ID', placeholder: 'com.spotify.music', required: true },
      { name: 'short', label: 'Short format', type: 'checkbox' }
    ],
    convert(values) {
      return { ...values, short: Boolean(values.short) };
    },
  },
  {
    id: 'datasafety',
    label: 'datasafety()',
    description: 'Inspect the data safety section.',
    fields: [
      { name: 'appId', label: 'App ID', required: true, placeholder: 'com.spotify.music' },
      { name: 'lang', label: 'Language', value: 'en' }
    ],
  },
  {
    id: 'categories',
    label: 'categories()',
    description: 'List available categories.',
    fields: [],
  }
];

let activeId = formConfigs[0].id;

function renderTabs() {
  tabsEl.innerHTML = '';
  formConfigs.forEach((cfg) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = cfg.label;
    button.className = cfg.id === activeId ? 'tab active' : 'tab';
    button.addEventListener('click', () => {
      activeId = cfg.id;
      renderTabs();
      renderForm();
      output.textContent = '// Pick a method, fill the form, and submit to inspect the response.';
    });
    tabsEl.append(button);
  });
}

function renderForm() {
  const cfg = formConfigs.find((c) => c.id === activeId);
  formsEl.innerHTML = '';
  const form = document.createElement('form');
  form.dataset.method = cfg.id;

  const title = document.createElement('h2');
  title.textContent = cfg.label;
  const desc = document.createElement('p');
  desc.textContent = cfg.description;

  const fieldset = document.createElement('fieldset');
  cfg.fields.forEach((field) => {
    const wrapper = document.createElement('label');
    wrapper.textContent = field.label;
    wrapper.className = 'field';
    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      field.options.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        input.append(opt);
      });
      if (field.value !== undefined) {
        input.value = String(field.value);
      } else if (field.options.length) {
        input.value = String(field.options[0].value);
      }
    } else if (field.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      if (field.value) input.checked = field.value;
    } else {
      input = document.createElement('input');
      input.type = field.type === 'number' ? 'number' : 'text';
      if (field.value !== undefined) input.value = field.value;
      if (field.placeholder) input.placeholder = field.placeholder;
    }
    input.name = field.name;
    if (field.required) input.required = true;
    wrapper.append(input);
    fieldset.append(wrapper);
  });

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = `Run ${cfg.id}()`;

  form.append(title, desc, fieldset, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runMethod(cfg, form);
  });

  formsEl.append(form);
}

async function runMethod(cfg, form) {
  const formData = new FormData(form);
  const values = {};
  for (const [key, value] of formData.entries()) {
    const field = cfg.fields.find((f) => f.name === key);
    if (field?.type === 'checkbox') {
      values[key] = true;
    } else if (field?.type === 'number') {
      values[key] = value === '' ? undefined : Number(value);
    } else {
      values[key] = value;
    }
  }
  cfg.fields
    .filter((f) => f.type === 'checkbox' && !formData.has(f.name))
    .forEach((f) => { values[f.name] = false; });

  const payload = cfg.convert ? cfg.convert(values) : values;

  const context = { method: cfg.id, options: payload };
  renderNicePlaceholder('Loading…', context);
  output.textContent = '// Loading…';
  try {
    const response = await fetch(`/api/${cfg.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: payload }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || response.statusText);
    }
    const result = await response.json();
    renderNiceView(result, context);
    output.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    renderNiceError(error?.message || String(error), context);
    output.textContent = `Error: ${error.message || error}`;
  }
}

function renderContextBanner(context) {
  if (!niceViewEl || !context) return;
  if (context.method !== 'search') return;
  const info = document.createElement('div');
  const variant = context.options?.mode === 'global' ? 'global' : 'modern';
  info.className = 'result-info';
  info.dataset.variant = variant;
  info.textContent =
    variant === 'global'
      ? 'Legacy results via /work/search (proxy required for regional data)'
      : 'Default results via /store/search';
  niceViewEl.append(info);
}

function renderResultLink(context) {
  if (!niceViewEl || !context) return;
  const href = resolvePreviewLink(context);
  if (!href) return;
  const link = document.createElement('a');
  link.className = 'result-link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = href;
  niceViewEl.append(link);
}

function renderNicePlaceholder(message = 'Select a method and run it to see a preview.', context) {
  if (!niceViewEl) return;
  niceViewEl.innerHTML = '';
  renderContextBanner(context);
  renderResultLink(context);
  const note = document.createElement('div');
  note.className = 'empty-state';
  note.textContent = message;
  niceViewEl.append(note);
}

function renderNiceError(message, context) {
  if (!niceViewEl) return;
  niceViewEl.innerHTML = '';
  renderContextBanner(context);
  renderResultLink(context);
  const note = document.createElement('div');
  note.className = 'empty-state error';
  note.textContent = message;
  niceViewEl.append(note);
}

function renderNiceView(result, context = {}) {
  if (!niceViewEl) return;
  niceViewEl.innerHTML = '';
  renderContextBanner(context);
  renderResultLink(context);

  const normalized = normalizeNiceView(result);
  if (!normalized) {
    const note = document.createElement('div');
    note.className = 'empty-state';
    note.textContent = 'No preview available for this response.';
    niceViewEl.append(note);
    return;
  }

  switch (normalized.type) {
    case 'app-list':
      renderAppCards(normalized.items, context);
      break;
    case 'review-list':
      renderReviewCards(normalized.items, context);
      break;
    case 'string-list':
      renderStringList(normalized.items, context);
      break;
    case 'object':
      renderObjectSummary(normalized.item, context);
      break;
    case 'app-detail':
      renderAppCards([normalized.item], context);
      break;
    case 'text':
      renderNicePlaceholder(normalized.text, context);
      break;
    default:
      renderNicePlaceholder('No preview available for this response.', context);
  }
}

function normalizeNiceView(data) {
  if (data === null || data === undefined) return null;
  if (typeof data === 'string') return { type: 'text', text: data };
  if (typeof data === 'number' || typeof data === 'boolean') {
    return { type: 'text', text: String(data) };
  }

  if (Array.isArray(data)) {
    return normalizeArray(data);
  }

  if (typeof data === 'object') {
    const keys = ['results', 'apps', 'items', 'list', 'documents', 'categories'];
    for (const key of keys) {
      if (Array.isArray(data[key])) {
        const normalized = normalizeArray(data[key]);
        if (normalized) return normalized;
      }
    }
    if (isAppLike(data)) return { type: 'app-detail', item: data };
    return { type: 'object', item: data };
  }
  return null;
}

function normalizeArray(items) {
  const filtered = items.filter((item) => item !== null && item !== undefined);
  if (filtered.length === 0) return { type: 'text', text: 'No data returned.' };

  if (typeof filtered[0] === 'string') {
    return { type: 'string-list', items: filtered.slice(0, 50) };
  }

  const representative = filtered.find((item) => typeof item === 'object');
  if (!representative) {
    return { type: 'string-list', items: filtered.map((v) => String(v)).slice(0, 50) };
  }

  if (isReviewLike(representative)) {
    return { type: 'review-list', items: filtered.filter(isReviewLike).slice(0, 25) };
  }

  if (isAppLike(representative)) {
    return { type: 'app-list', items: filtered.filter(isAppLike).slice(0, 30) };
  }

  return { type: 'object', item: representative };
}

function isAppLike(item) {
  if (!item || typeof item !== 'object') return false;
  return Boolean(item.appId || item.title || item.name || item.url);
}

function isReviewLike(item) {
  if (!item || typeof item !== 'object') return false;
  return Boolean(item.userName || item.username) && Boolean(item.text || item.content);
}

function renderAppCards(items, context) {
  if (!items.length) {
    renderNicePlaceholder('No apps to display.', context);
    return;
  }
  items.forEach((item) => {
    niceViewEl.append(buildAppCard(item));
  });
}

function buildAppCard(item) {
  const card = document.createElement('article');
  card.className = 'card app';

  const icon = document.createElement('img');
  icon.src = getIcon(item);
  icon.alt = item.title || item.name || 'App icon';

  const meta = document.createElement('div');
  meta.className = 'meta';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = item.title || item.name || item.appId || 'Untitled';

  const subtitle = document.createElement('div');
  subtitle.className = 'subtitle';
  subtitle.textContent = buildSubtitle(item);

  const summary = document.createElement('div');
  summary.className = 'summary';
  summary.textContent = buildSummary(item);

  const price = document.createElement('div');
  price.className = 'price';
  price.textContent = buildPrice(item);

  const rating = buildRating(item);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const link = buildStoreLink(item);
  if (link) actions.append(link);

  meta.append(title, subtitle);
  if (rating) meta.append(rating);
  if (summary.textContent) meta.append(summary);
  if (price.textContent) meta.append(price);
  if (actions.childElementCount > 0) meta.append(actions);

  card.append(icon, meta);
  return card;
}

function getIcon(item) {
  return (
    item.icon ||
    item.image ||
    item.thumbnail ||
    item.iconImage ||
    item.logoUrl ||
    'https://play-lh.googleusercontent.com/a-/AAuE7mBz-placeholder'
  );
}

function buildSubtitle(item) {
  const parts = [];
  if (item.developer) parts.push(item.developer);
  else if (item.developerId) parts.push(item.developerId);
  else if (item.seller) parts.push(item.seller);
  if (item.genre) parts.push(item.genre);
  if (item.category) parts.push(item.category);
  return parts.join(' • ') || '—';
}

function buildSummary(item) {
  const text = item.summary || item.descriptionShort || item.tagline || '';
  return text ? truncate(text, 160) : '';
}

function buildPrice(item) {
  if (item.priceText) return item.priceText;
  if (typeof item.free === 'boolean') return item.free ? 'Free' : formatPrice(item);
  if (typeof item.price === 'number') return formatPrice(item);
  return '';
}

function formatPrice(item) {
  const amount = typeof item.price === 'number' ? item.price : item.minPrice;
  if (amount === undefined) return '';
  const currency = item.currency || item.priceCurrency || 'USD';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function buildRating(item) {
  const score = item.score || item.rating;
  const count = item.ratings || item.reviews || item.ratingCount;
  if (score === undefined) return null;
  const container = document.createElement('div');
  container.className = 'rating';
  const stars = document.createElement('span');
  stars.textContent = '★'.repeat(Math.round(score)) || '★';
  const label = document.createElement('span');
  label.textContent = `${Number(score).toFixed(1)}${count ? ` • ${formatCount(count)} ratings` : ''}`;
  container.append(stars, label);
  return container;
}

function buildStoreLink(item) {
  const href =
    item.url ||
    item.playstoreUrl ||
    (item.appId ? `https://play.google.com/store/apps/details?id=${item.appId}` : undefined);
  if (!href) return null;
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'View in Store';
  return link;
}

function renderReviewCards(items, context) {
  if (!items.length) {
    renderNicePlaceholder('No reviews to display.', context);
    return;
  }
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'card review';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const heading = document.createElement('div');
    heading.className = 'title';
    heading.textContent = item.userName || item.username || 'Anonymous';

    const rating = buildRating({ score: item.score || item.rating, ratings: item.thumbsUp || item.helpful });
    if (rating) meta.append(rating);

    const summary = document.createElement('div');
    summary.className = 'summary';
    summary.textContent = truncate(item.text || item.content || '', 260);

    meta.append(heading, summary);
    card.append(meta);
    niceViewEl.append(card);
  });
}

function renderStringList(items, context) {
  if (!items.length) {
    renderNicePlaceholder('No entries to display.', context);
    return;
  }
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'card review';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = item;
    meta.append(title);
    card.append(meta);
    niceViewEl.append(card);
  });
}

function renderObjectSummary(item, context) {
  const entries = Object.entries(item).slice(0, 12);
  if (!entries.length) {
    renderNicePlaceholder('Object is empty.', context);
    return;
  }
  const card = document.createElement('article');
  card.className = 'card review';
  const meta = document.createElement('div');
  meta.className = 'meta';
  entries.forEach(([key, value]) => {
    const row = document.createElement('div');
    row.className = 'summary';
    row.innerHTML = `<span class="pill">${key}</span> ${formatValue(value)}`;
    meta.append(row);
  });
  card.append(meta);
  niceViewEl.append(card);
}

function formatValue(value) {
  if (typeof value === 'string') return truncate(value, 140);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.slice(0, 4).map((v) => formatValue(v)).join(', ')}${value.length > 4 ? ', …' : ''}]`;
  if (value && typeof value === 'object') return '{…}';
  return '—';
}

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function formatCount(count) {
  if (typeof count !== 'number') return String(count);
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function safeJsonParse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function resolvePreviewLink(context) {
  if (!context || context.method !== 'search') return null;
  const opts = context.options || {};
  if (!opts.term) return null;
  const params = new URLSearchParams();
  params.set('q', opts.term);
  params.set('hl', opts.lang || 'en');
  params.set('gl', opts.country || 'us');
  const price = normalizePriceFilter(opts.price);
  params.set('price', String(price));
  const mode = opts.mode === 'global' ? 'global' : 'modern';
  if (mode === 'modern') {
    params.set('c', 'apps');
  }
  const basePath = mode === 'global' ? '/work/search' : '/store/search';
  return `https://play.google.com${basePath}?${params.toString()}`;
}

function normalizePriceFilter(price) {
  if (!price) return 0;
  const value = String(price).toLowerCase();
  if (value === 'free') return 1;
  if (value === 'paid') return 2;
  if (value === 'all') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setupProxyPanel(initialStatus) {
  if (!proxyPanel) return;

  proxyPanel.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Proxy configuration';

  const description = document.createElement('p');
  description.className = 'note';
  description.textContent = 'Optional: route requests through an HTTP(S) proxy for debugging or geolocation tests. Include credentials if required.';

  const summaryEl = document.createElement('div');
  summaryEl.className = 'proxy-summary';

  const form = document.createElement('form');
  form.className = 'proxy-form';

  const defaultField = document.createElement('label');
  defaultField.className = 'field';
  defaultField.textContent = 'Default proxy URL (optional)';
  const defaultInput = document.createElement('input');
  defaultInput.type = 'text';
  defaultInput.name = 'defaultUrl';
  defaultInput.placeholder = 'http(s)://user:pass@host:8080';
  defaultField.append(defaultInput);
  form.append(defaultField);

  const defaultInsecureField = document.createElement('label');
  defaultInsecureField.className = 'checkbox-field';
  const defaultInsecureInput = document.createElement('input');
  defaultInsecureInput.type = 'checkbox';
  defaultInsecureInput.name = 'defaultAllowInsecure';
  if (initialStatus?.default?.insecure) defaultInsecureInput.checked = true;
  const defaultInsecureText = document.createElement('span');
  defaultInsecureText.textContent = 'Allow invalid proxy certificates';
  defaultInsecureField.append(defaultInsecureInput, defaultInsecureText);
  form.append(defaultInsecureField);

  const perCountrySection = document.createElement('div');
  perCountrySection.className = 'proxy-country';
  const perCountryHeader = document.createElement('div');
  perCountryHeader.className = 'proxy-country-header';
  perCountryHeader.textContent = 'Per-country overrides (country code + proxy URL)';
  perCountrySection.append(perCountryHeader);

  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'proxy-rows';
  perCountrySection.append(rowsContainer);

  const addRowButton = document.createElement('button');
  addRowButton.type = 'button';
  addRowButton.className = 'link';
  addRowButton.textContent = 'Add country proxy';
  addRowButton.addEventListener('click', () => addCountryRow(rowsContainer));
  perCountrySection.append(addRowButton);

  form.append(perCountrySection);

  const actions = document.createElement('div');
  actions.className = 'proxy-actions';

  const applyButton = document.createElement('button');
  applyButton.type = 'submit';
  applyButton.textContent = 'Apply proxy';
  actions.append(applyButton);

  const disableButton = document.createElement('button');
  disableButton.type = 'button';
  disableButton.className = 'link';
  disableButton.textContent = 'Disable proxies';
  actions.append(disableButton);

  form.append(actions);

  const feedbackEl = document.createElement('p');
  feedbackEl.className = 'proxy-feedback';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitProxyConfiguration(form, rowsContainer, summaryEl, feedbackEl);
  });

  disableButton.addEventListener('click', async () => {
    await disableProxyConfiguration(form, rowsContainer, summaryEl, feedbackEl);
  });

  proxyPanel.append(title, description, summaryEl, form, feedbackEl);
  addCountryRow(rowsContainer);
  updateProxySummary(summaryEl, initialStatus);
}

async function submitProxyConfiguration(form, rowsContainer, summaryEl, feedbackEl) {
  setProxyFeedback(feedbackEl, '');
  const entries = [];

  const defaultInput = form.elements.namedItem('defaultUrl');
  const defaultUrl = typeof defaultInput?.value === 'string' ? defaultInput.value.trim() : '';
  const defaultInsecureInput = form.querySelector('input[name="defaultAllowInsecure"]');
  const defaultAllowInsecure = defaultInsecureInput?.checked ?? false;
  if (defaultUrl) {
    const entry = { scope: 'default', url: defaultUrl };
    if (defaultAllowInsecure) entry.allowInsecure = true;
    entries.push(entry);
  }

  const rowEls = rowsContainer.querySelectorAll('[data-proxy-row]');
  for (const row of rowEls) {
    const countryInput = row.querySelector('input[name="country"]');
    const urlInput = row.querySelector('input[name="url"]');
    const country = countryInput?.value?.trim() ?? '';
    const url = urlInput?.value?.trim() ?? '';
    const insecureInput = row.querySelector('input[name="allowInsecure"]');
    const allowInsecure = insecureInput?.checked ?? false;
    if (!country && !url) continue;
    if (!/^[a-z]{2}$/i.test(country)) {
      setProxyFeedback(feedbackEl, 'Country overrides require a 2-letter ISO code.', 'error');
      countryInput?.focus();
      return;
    }
    if (!url) {
      setProxyFeedback(feedbackEl, `Proxy URL missing for country ${country.toUpperCase()}.`, 'error');
      urlInput?.focus();
      return;
    }
    const entry = { scope: 'country', country: country.toLowerCase(), url };
    if (allowInsecure) entry.allowInsecure = true;
    entries.push(entry);
  }

  if (!entries.length) {
    setProxyFeedback(feedbackEl, 'Add a proxy URL or use “Disable proxies”.', 'error');
    return;
  }

  try {
    setProxyFeedback(feedbackEl, 'Applying proxy configuration…', 'pending');
    const response = await fetch('/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
    const text = await response.text();
    let payload = {};
    payload = safeJsonParse(text);
    if (!response.ok) {
      throw new Error(payload.error || response.statusText);
    }
    proxyStatus = payload.proxy ?? { enabled: false };
    updateProxySummary(summaryEl, proxyStatus);
    setProxyFeedback(feedbackEl, 'Proxy configuration updated.', 'success');
  } catch (error) {
    setProxyFeedback(feedbackEl, `Failed to apply proxy: ${error.message || error}`, 'error');
  }
}

async function disableProxyConfiguration(form, rowsContainer, summaryEl, feedbackEl) {
  try {
    setProxyFeedback(feedbackEl, 'Disabling proxies…', 'pending');
    const response = await fetch('/proxy', { method: 'DELETE' });
    if (!response.ok) {
      const text = await response.text();
      const payload = safeJsonParse(text);
      throw new Error(payload.error || response.statusText);
    }
    proxyStatus = { enabled: false };
    form.reset();
    rowsContainer.innerHTML = '';
    addCountryRow(rowsContainer);
    updateProxySummary(summaryEl, proxyStatus);
    setProxyFeedback(feedbackEl, 'Proxy disabled.', 'success');
  } catch (error) {
    setProxyFeedback(feedbackEl, `Failed to disable proxy: ${error.message || error}`, 'error');
  }
}

function addCountryRow(container, values = {}) {
  const row = document.createElement('div');
  row.className = 'proxy-row';
  row.dataset.proxyRow = '1';

  const countryInput = document.createElement('input');
  countryInput.type = 'text';
  countryInput.name = 'country';
  countryInput.placeholder = 'us';
  countryInput.maxLength = 2;
  countryInput.autocomplete = 'off';
  countryInput.setAttribute('aria-label', 'Country code');
  if (values.country) countryInput.value = values.country;

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.name = 'url';
  urlInput.placeholder = 'http(s)://proxy.example.com:8080';
  urlInput.autocomplete = 'off';
  urlInput.setAttribute('aria-label', 'Proxy URL');
  if (values.url) urlInput.value = values.url;

  const insecureLabel = document.createElement('label');
  insecureLabel.className = 'checkbox-inline';
  const insecureInput = document.createElement('input');
  insecureInput.type = 'checkbox';
  insecureInput.name = 'allowInsecure';
  const insecureText = document.createElement('span');
  insecureText.textContent = 'Allow invalid certs';
  insecureLabel.append(insecureInput, insecureText);
  if (values.allowInsecure) insecureInput.checked = true;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'link';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', () => {
    container.removeChild(row);
  });

  row.append(countryInput, urlInput, insecureLabel, removeButton);
  container.append(row);
  countryInput.focus();
}

function updateProxySummary(summaryEl, status) {
  if (!summaryEl) return;
  summaryEl.innerHTML = '';

  if (!status?.enabled) {
    summaryEl.dataset.state = 'disabled';
    delete summaryEl.dataset.insecure;
    const text = document.createElement('span');
    text.textContent = 'Proxy disabled. Requests go directly to Google Play.';
    summaryEl.append(text);
    return;
  }

  summaryEl.dataset.state = 'enabled';
  const insecureEnabled = Boolean(status?.default?.insecure || (Array.isArray(status?.perCountry) && status.perCountry.some((entry) => entry.insecure)));
  if (insecureEnabled) {
    summaryEl.dataset.insecure = 'true';
  } else {
    delete summaryEl.dataset.insecure;
  }

  const title = document.createElement('span');
  title.textContent = insecureEnabled ? 'Proxy enabled (TLS insecure):' : 'Proxy enabled:';
  summaryEl.append(title);

  const list = document.createElement('ul');
  if (status.default) {
    const item = document.createElement('li');
    item.textContent = `Default → ${formatProxyRoute(status.default)}`;
    list.append(item);
  }
  if (Array.isArray(status.perCountry)) {
    status.perCountry.forEach((entry) => {
      const item = document.createElement('li');
      const label = entry.country ? entry.country.toUpperCase() : '??';
      item.textContent = `${label} → ${formatProxyRoute(entry)}`;
      list.append(item);
    });
  }
  if (list.childElementCount > 0) {
    summaryEl.append(list);
  }
}

function formatProxyRoute(entry) {
  const extras = [];
  if (entry.hasAuth) extras.push('auth');
  if (entry.headers && entry.headers.length) {
    extras.push(`${entry.headers.length} header${entry.headers.length > 1 ? 's' : ''}`);
  }
  if (entry.insecure) extras.push('TLS insecure');
  const suffix = extras.length ? ` (${extras.join(', ')})` : '';

  if (entry.maskedUrl && entry.maskedUrl !== '[invalid-url]') return `${entry.maskedUrl}${suffix}`;
  const host = entry.host ?? 'unknown-host';
  const port = entry.port ? `:${entry.port}` : '';
  const protocol = entry.protocol ?? 'http';
  return `${protocol}://${host}${port}${suffix}`;
}

function setProxyFeedback(element, message, status) {
  if (!element) return;
  element.textContent = message;
  if (status) {
    element.dataset.status = status;
  } else {
    delete element.dataset.status;
  }
}

setupProxyPanel(proxyStatus);
renderNicePlaceholder();
renderTabs();
renderForm();
