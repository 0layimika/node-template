const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCard = require('@app/repository/creator-card');
const { CreatorCardMessages } = require('@app/messages');
const { serializeCreatorCard } = require('./helpers');

const spec = `root {
  slug string<trim|minLength:1>
  creator_reference string<trim|length:20>
}`;

const parsedSpec = validator.parse(spec);

async function deleteCreatorCard(serviceData, options = {}) {
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

    if (creatorCard.creator_reference !== data.creator_reference) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, 'NF01');
    }

    const deletedAt = Date.now();

    await CreatorCard.updateOne({
      query: { _id: creatorCard._id },
      updateValues: { deleted: deletedAt },
      options,
    });

    response = serializeCreatorCard({
      ...creatorCard,
      deleted: deletedAt,
      updated: deletedAt,
    });
    appLogger.info(
      {
        id: response.id,
        slug: response.slug,
        deleted: response.deleted,
      },
      'delete-creator-card-success'
    );
  } catch (error) {
    appLogger.errorX(error, 'delete-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = deleteCreatorCard;
