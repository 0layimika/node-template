const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCard = require('@app/repository/creator-card');
const { CreatorCardMessages } = require('@app/messages');
const { serializeCreatorCard } = require('./helpers');

const spec = `root {
  slug string<trim|minLength:1>
  access_code? string<trim|length:6>
}`;

const parsedSpec = validator.parse(spec);

async function getCreatorCard(serviceData, options = {}) {
  let response;
  const data = validator.validate(serviceData, parsedSpec);

  try {
    const creatorCard = await CreatorCard.findOne({
      query: { slug: data.slug },
      options,
    });

    if (!creatorCard) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, 'NF01');
    }

    if (creatorCard.status === 'draft') {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, 'NF02');
    }

    if (creatorCard.access_type === 'private' && !data.access_code) {
      throwAppError(CreatorCardMessages.PRIVATE_CARD_REQUIRES_ACCESS_CODE, 'AC03');
    }

    if (creatorCard.access_type === 'private' && data.access_code !== creatorCard.access_code) {
      throwAppError(CreatorCardMessages.INVALID_ACCESS_CODE, 'AC04');
    }

    response = serializeCreatorCard(creatorCard, { hideAccessCode: true });
    appLogger.info(
      {
        id: response.id,
        slug: response.slug,
        status: response.status,
        access_type: response.access_type,
      },
      'get-creator-card-success'
    );
  } catch (error) {
    appLogger.errorX(error, 'get-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = getCreatorCard;
