const { expect } = require('chai');
const { MockModelStubs } = require('@app/mock-models');
const getCreatorCard = require('@app/services/creator-cards/get-creator-card');

describe('getCreatorCard', () => {
  let stub;

  afterEach(() => {
    if (stub) {
      stub.revert();
      stub = null;
    }
  });

  it('returns a public published card with no access_code field', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({
      method: 'findOne',
      docConfig: { status: 'published', access_type: 'public', access_code: null },
    });

    const response = await getCreatorCard({ slug: 'george-cooks' });

    expect(response.slug).to.equal('george-cooks');
    expect(response).to.not.have.property('access_code');
    expect(response).to.not.have.property('_id');
    expect(response.deleted).to.equal(null);
  });

  it('returns a private card when the correct access_code is supplied', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({
      method: 'findOne',
      docConfig: { status: 'published', access_type: 'private', access_code: 'A1B2C3' },
    });

    const response = await getCreatorCard({ slug: 'vip-rate-card', access_code: 'A1B2C3' });

    expect(response.access_type).to.equal('private');
    expect(response).to.not.have.property('access_code');
  });

  it('returns NF01 when no card exists for the slug', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({ method: 'findOne', mockNull: true });

    try {
      await getCreatorCard({ slug: 'does-not-exist-123' });
      throw new Error('expected getCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('NF01');
    }
  });

  it('returns NF01 even for a slug shorter than the create-time minimum', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({ method: 'findOne', mockNull: true });

    try {
      await getCreatorCard({ slug: 'ab' });
      throw new Error('expected getCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('NF01');
    }
  });

  it('returns NF02 when the card exists but is a draft', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({
      method: 'findOne',
      docConfig: { status: 'draft', access_type: 'public' },
    });

    try {
      await getCreatorCard({ slug: 'my-draft-card' });
      throw new Error('expected getCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('NF02');
    }
  });

  it('returns AC03 when a private card is requested without an access_code', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({
      method: 'findOne',
      docConfig: { status: 'published', access_type: 'private', access_code: 'A1B2C3' },
    });

    try {
      await getCreatorCard({ slug: 'vip-rate-card' });
      throw new Error('expected getCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('AC03');
    }
  });

  it('returns AC04 when a private card is requested with the wrong access_code', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({
      method: 'findOne',
      docConfig: { status: 'published', access_type: 'private', access_code: 'A1B2C3' },
    });

    try {
      await getCreatorCard({ slug: 'vip-rate-card', access_code: 'WRONG1' });
      throw new Error('expected getCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('AC04');
    }
  });
});
