const { expect } = require('chai');
const { MockModelStubs } = require('@app/mock-models');
const createCreatorCard = require('@app/services/creator-cards/create-creator-card');

describe('createCreatorCard', () => {
  let stubs;

  beforeEach(() => {
    stubs = [];
  });

  afterEach(() => {
    stubs.forEach((stub) => stub.revert());
  });

  function slugIsFree() {
    stubs.push(MockModelStubs.CreatorCard.configureStubs({ method: 'findOne', mockNull: true }));
  }

  it('creates a card with a client-provided slug, defaulting access_type to public', async () => {
    slugIsFree();

    const response = await createCreatorCard({
      title: 'George Cooks',
      description: 'Weekly cooking podcast',
      slug: 'george-cooks',
      creator_reference: 'crt_8f2k1m9x4p7w3q5z',
      links: [{ title: 'YouTube', url: 'https://youtube.com/@georgecooks' }],
      service_rates: {
        currency: 'NGN',
        rates: [{ name: 'IG Story Post', description: 'One story mention', amount: 5000000 }],
      },
      status: 'published',
    });

    expect(response).to.not.have.property('_id');
    expect(response.id).to.be.a('string');
    expect(response.slug).to.equal('george-cooks');
    expect(response.access_type).to.equal('public');
    expect(response.access_code).to.equal(null);
    expect(response.deleted).to.equal(null);
  });

  it('auto-generates a slug from the title when slug is omitted', async () => {
    slugIsFree();

    const response = await createCreatorCard({
      title: 'Ada Designs Things',
      creator_reference: 'crt_a1b2c3d4e5f6g7h8',
      status: 'published',
    });

    expect(response.slug).to.equal('ada-designs-things');
  });

  it('creates a private card and returns the access_code in the response', async () => {
    slugIsFree();

    const response = await createCreatorCard({
      title: 'VIP Rate Card',
      creator_reference: 'crt_x9y8z7w6v5u4t3s2',
      status: 'published',
      access_type: 'private',
      access_code: 'A1B2C3',
    });

    expect(response.access_type).to.equal('private');
    expect(response.access_code).to.equal('A1B2C3');
  });

  it('rejects a client-provided slug that is already taken (SL02)', async () => {
    try {
      await createCreatorCard({
        title: 'Another George',
        slug: 'george-cooks',
        creator_reference: 'crt_m1n2b3v4c5x6z7l8',
        status: 'published',
      });
      throw new Error('expected createCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('SL02');
    }
  });

  it('rejects a private card with no access_code (AC01)', async () => {
    try {
      await createCreatorCard({
        title: 'Secret Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'published',
        access_type: 'private',
      });
      throw new Error('expected createCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('AC01');
    }
  });

  it('rejects an access_code on a public card (AC05)', async () => {
    try {
      await createCreatorCard({
        title: 'Public Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'published',
        access_type: 'public',
        access_code: 'A1B2C3',
      });
      throw new Error('expected createCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('AC05');
    }
  });

  it('lets the framework validator reject an invalid status enum value with HTTP 400', async () => {
    try {
      await createCreatorCard({
        title: 'Bad Status Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'archived',
      });
      throw new Error('expected createCreatorCard to throw');
    } catch (error) {
      expect(error.isApplicationError).to.equal(true);
    }
  });

  it('lets the framework validator reject an empty service_rates.rates array', async () => {
    // VSL treats a required `field[]` (no `?`) as unsatisfied when given an empty array,
    // so this is rejected before any business logic runs - no custom code needed here.
    slugIsFree();

    try {
      await createCreatorCard({
        title: 'Empty Rates Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'published',
        service_rates: { currency: 'NGN', rates: [] },
      });
      throw new Error('expected createCreatorCard to throw');
    } catch (error) {
      expect(error.isApplicationError).to.equal(true);
    }
  });

  it('rejects a non-integer rate amount', async () => {
    slugIsFree();

    try {
      await createCreatorCard({
        title: 'Bad Rate Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'published',
        service_rates: {
          currency: 'NGN',
          rates: [{ name: 'IG Story Post', description: 'desc', amount: 1.5 }],
        },
      });
      throw new Error('expected createCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('VALIDATION_ERROR');
    }
  });

  it('rejects a link whose url is missing the http(s) scheme', async () => {
    slugIsFree();

    try {
      await createCreatorCard({
        title: 'Bad Link Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'published',
        links: [{ title: 'Sketchy', url: 'ftp://example.com' }],
      });
      throw new Error('expected createCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('VALIDATION_ERROR');
    }
  });
});
