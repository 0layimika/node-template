const { expect } = require('chai');
const { MockModelStubs } = require('@app/mock-models');
const deleteCreatorCard = require('@app/services/creator-cards/delete-creator-card');

describe('deleteCreatorCard', () => {
  let stub;

  afterEach(() => {
    if (stub) {
      stub.revert();
      stub = null;
    }
  });

  it('deletes a card owned by the given creator_reference and returns it with deleted set', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({
      method: 'findOne',
      docConfig: {
        status: 'published',
        access_type: 'public',
        creator_reference: 'crt_a1b2c3d4e5f6g7h8',
      },
    });

    const response = await deleteCreatorCard({
      slug: 'ada-designs-things',
      creator_reference: 'crt_a1b2c3d4e5f6g7h8',
    });

    expect(response).to.not.have.property('_id');
    expect(response.slug).to.equal('ada-designs-things');
    expect(response.deleted).to.be.a('number');
    expect(response.updated).to.equal(response.deleted);
  });

  it('returns NF01 when no card exists for the slug', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({ method: 'findOne', mockNull: true });

    try {
      await deleteCreatorCard({
        slug: 'does-not-exist-123',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
      });
      throw new Error('expected deleteCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('NF01');
    }
  });

  it('returns NF01 even for a slug shorter than the create-time minimum', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({ method: 'findOne', mockNull: true });

    try {
      await deleteCreatorCard({ slug: 'ab', creator_reference: 'crt_q1w2e3r4t5y6u7i8' });
      throw new Error('expected deleteCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('NF01');
    }
  });

  it('returns NF01 when the creator_reference does not match the card owner', async () => {
    stub = MockModelStubs.CreatorCard.configureStubs({
      method: 'findOne',
      docConfig: {
        status: 'published',
        access_type: 'public',
        creator_reference: 'crt_a1b2c3d4e5f6g7h8',
      },
    });

    try {
      await deleteCreatorCard({
        slug: 'ada-designs-things',
        creator_reference: 'crt_someoneelseeeee1',
      });
      throw new Error('expected deleteCreatorCard to throw');
    } catch (error) {
      expect(error.errorCode).to.equal('NF01');
    }
  });
});
