const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCard = require('@app/repository/creator-card');
const { CreatorCardMessages } = require('@app/messages');
const {
  generateUniqueSlug,
  serializeCreatorCard,
  slugExists,
  isValidSlug,
  isValidAccessCode,
  linkHasValidUrl,
} = require('./helpers');

const spec = `root {
  title string<trim|minLength:3|maxLength:100>
  description? string<trim|maxLength:500>
  slug? string<trim|minLength:5|maxLength:50>
  creator_reference string<trim|length:20>
  links[]? {
    title string<trim|minLength:1|maxLength:100>
    url string<trim|maxLength:200>
  }
  service_rates? {
    currency string(NGN|USD|GBP|GHS)
    rates[] {
      name string<trim|minLength:3|maxLength:100>
      description string<trim|maxLength:250>
      amount number<min:1>
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string<trim|length:6>
}`;

const parsedSpec = validator.parse(spec);

async function createCreatorCard(serviceData, options = {}) {
  let response;
  const data = validator.validate(serviceData, parsedSpec);

  try {
    const accessType = data.access_type || 'public';
    let { slug } = data;
    const serviceRates = data.service_rates;

    if (accessType === 'private' && !data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_REQUIRED, 'AC01');
    }

    if (accessType === 'public' && data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_FORBIDDEN, 'AC05');
    }

    if (data.access_code && !isValidAccessCode(data.access_code)) {
      throwAppError(CreatorCardMessages.INVALID_ACCESS_CODE_FORMAT, ERROR_CODE.VALIDATIONERR);
    }

    if (slug) {
      if (!isValidSlug(slug)) {
        throwAppError(CreatorCardMessages.INVALID_SLUG_FORMAT, ERROR_CODE.VALIDATIONERR);
      }

      if (await slugExists({ repository: CreatorCard, slug, includeDeleted: true })) {
        throwAppError(CreatorCardMessages.SLUG_TAKEN, 'SL02');
      }
    } else {
      slug = await generateUniqueSlug({ title: data.title, repository: CreatorCard });
    }

    if (Array.isArray(data.links) && data.links.some((link) => !linkHasValidUrl(link))) {
      throwAppError(CreatorCardMessages.INVALID_LINK_URL, ERROR_CODE.VALIDATIONERR);
    }

    if (serviceRates?.rates?.some((rate) => !Number.isInteger(rate.amount) || rate.amount < 1)) {
      throwAppError(CreatorCardMessages.INVALID_RATE_AMOUNT, ERROR_CODE.VALIDATIONERR);
    }

    const createdCard = await CreatorCard.create(
      {
        title: data.title,
        description: data.description || null,
        slug,
        creator_reference: data.creator_reference,
        links: data.links || [],
        service_rates: serviceRates || null,
        status: data.status,
        access_type: accessType,
        access_code: accessType === 'private' ? data.access_code : null,
      },
      options
    );

    response = serializeCreatorCard(createdCard);
    appLogger.info(
      {
        id: response.id,
        slug: response.slug,
        status: response.status,
        access_type: response.access_type,
      },
      'create-creator-card-success'
    );
  } catch (error) {
    if (error.errorCode === ERROR_CODE.DUPLRCRD) {
      throwAppError(CreatorCardMessages.SLUG_TAKEN, 'SL02');
    }

    appLogger.errorX(error, 'create-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = createCreatorCard;
