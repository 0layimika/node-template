const { randomBytes } = require('@app-core/randomness');

const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789_-';
const ACCESS_CODE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const WHITESPACE_CHARS = ' \t\n\r\f\v';
const MAX_SLUG_GENERATION_ATTEMPTS = 25;
const MAX_SLUG_LENGTH = 50;
// "-" + 6-char random suffix; the base must leave room for this when a suffix is appended.
const SUFFIX_LENGTH = 7;
const MAX_SLUG_BASE_LENGTH = MAX_SLUG_LENGTH - SUFFIX_LENGTH;

function buildSlugBase(title = '') {
  let result = '';
  let lastCharWasHyphen = false;

  title
    .trim()
    .toLowerCase()
    .split('')
    .forEach((char) => {
      const normalizedChar = WHITESPACE_CHARS.includes(char) ? '-' : char;
      const isAllowedChar = SLUG_CHARS.includes(normalizedChar);

      if (!isAllowedChar) return;
      if (result.length >= MAX_SLUG_BASE_LENGTH) return;

      if (normalizedChar === '-') {
        if (lastCharWasHyphen) return;
        lastCharWasHyphen = true;
      } else {
        lastCharWasHyphen = false;
      }

      result += normalizedChar;
    });

  while (result.startsWith('-')) {
    result = result.slice(1);
  }

  while (result.endsWith('-')) {
    result = result.slice(0, -1);
  }

  return result;
}

function createRandomSuffix() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  const seed = randomBytes(12);
  let index = 0;

  while (suffix.length < 6) {
    const chunk = seed[index % seed.length];
    const position = chars.indexOf(chunk);
    suffix += chars[position >= 0 ? position : index % chars.length];
    index += 1;
  }

  return suffix;
}

async function slugExists({ repository, slug, includeDeleted = false }) {
  let existingCard = null;

  if (includeDeleted) {
    existingCard = await repository.raw().findOne({ slug }, null, { lean: true });
  } else {
    existingCard = await repository.findOne({
      query: { slug },
    });
  }

  return !!existingCard;
}

async function generateUniqueSlug({ title, repository }) {
  const baseSlug = buildSlugBase(title) || 'card';
  const slugCandidates = [];
  let slug;
  let attempt = 0;

  if (baseSlug.length >= 5) {
    slugCandidates.push(baseSlug);
  }

  while (attempt < MAX_SLUG_GENERATION_ATTEMPTS && !slug) {
    slugCandidates.push(`${baseSlug}-${createRandomSuffix()}`);
    attempt += 1;
  }

  while (slugCandidates.length && !slug) {
    const slugCandidate = slugCandidates.shift();
    // eslint-disable-next-line no-await-in-loop
    const existingCard = await slugExists({
      repository,
      slug: slugCandidate,
      includeDeleted: true,
    });

    if (!existingCard) {
      slug = slugCandidate;
    }
  }

  return slug || `${baseSlug}-${createRandomSuffix()}`;
}

function serializeCreatorCard(card, options = {}) {
  let serializedCard = null;
  const { hideAccessCode = false } = options;

  if (card) {
    const {
      _id: cardId,
      title,
      description = null,
      slug,
      creator_reference: creatorReference,
      links = [],
      service_rates: serviceRates = null,
      status,
      access_type: accessType = 'public',
      access_code: accessCode = null,
      created,
      updated,
      deleted,
    } = card;

    serializedCard = {
      id: cardId,
      title,
      description,
      slug,
      creator_reference: creatorReference,
      links,
      service_rates: serviceRates,
      status,
      access_type: accessType,
      created,
      updated,
      deleted: deleted || null,
    };

    if (!hideAccessCode) {
      serializedCard.access_code = accessCode;
    }
  }

  return serializedCard;
}

function isValidSlug(slug) {
  return (
    typeof slug === 'string' &&
    slug.length > 0 &&
    slug
      .toLowerCase()
      .split('')
      .every((char) => SLUG_CHARS.includes(char))
  );
}

function isValidAccessCode(accessCode) {
  return (
    typeof accessCode === 'string' &&
    accessCode.length === 6 &&
    accessCode.split('').every((char) => ACCESS_CODE_CHARS.includes(char))
  );
}

function linkHasValidUrl(link) {
  return (
    typeof link?.url === 'string' &&
    link.url.length <= 200 &&
    (link.url.startsWith('http://') || link.url.startsWith('https://'))
  );
}

module.exports = {
  generateUniqueSlug,
  serializeCreatorCard,
  slugExists,
  isValidSlug,
  isValidAccessCode,
  linkHasValidUrl,
};
