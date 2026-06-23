const { expect } = require('chai');
const {
  generateUniqueSlug,
  serializeCreatorCard,
  slugExists,
  isValidSlug,
  isValidAccessCode,
  linkHasValidUrl,
} = require('@app/services/creator-cards/helpers');

describe('creator-cards helpers', () => {
  describe('isValidSlug', () => {
    it('accepts letters, numbers, hyphens and underscores in any case', () => {
      expect(isValidSlug('George-Cooks_07')).to.equal(true);
    });

    it('rejects whitespace', () => {
      expect(isValidSlug('george cooks')).to.equal(false);
    });

    it('rejects symbols outside the allowed set', () => {
      expect(isValidSlug('george.cooks!')).to.equal(false);
    });

    it('rejects an empty string', () => {
      expect(isValidSlug('')).to.equal(false);
    });
  });

  describe('isValidAccessCode', () => {
    it('accepts exactly 6 alphanumeric characters', () => {
      expect(isValidAccessCode('A1B2C3')).to.equal(true);
    });

    it('rejects fewer than 6 characters', () => {
      expect(isValidAccessCode('A1B2C')).to.equal(false);
    });

    it('rejects more than 6 characters', () => {
      expect(isValidAccessCode('A1B2C3D')).to.equal(false);
    });

    it('rejects non-alphanumeric characters', () => {
      expect(isValidAccessCode('A1B2C-')).to.equal(false);
    });
  });

  describe('linkHasValidUrl', () => {
    it('accepts an https url', () => {
      expect(linkHasValidUrl({ url: 'https://youtube.com/@georgecooks' })).to.equal(true);
    });

    it('accepts an http url', () => {
      expect(linkHasValidUrl({ url: 'http://example.com' })).to.equal(true);
    });

    it('rejects a url without a http(s) scheme', () => {
      expect(linkHasValidUrl({ url: 'ftp://example.com' })).to.equal(false);
    });

    it('rejects a url longer than 200 characters', () => {
      const longUrl = `https://example.com/${'a'.repeat(200)}`;
      expect(linkHasValidUrl({ url: longUrl })).to.equal(false);
    });
  });

  describe('generateUniqueSlug', () => {
    const alwaysFreeRepository = {
      findOne: async () => null,
      raw: () => ({ findOne: async () => null }),
    };

    it('lowercases the title and hyphenates whitespace', async () => {
      const slug = await generateUniqueSlug({
        title: 'Ada Designs Things',
        repository: alwaysFreeRepository,
      });

      expect(slug).to.equal('ada-designs-things');
    });

    it('strips characters that are not letters, numbers, hyphens or underscores', async () => {
      const slug = await generateUniqueSlug({
        title: "George's Cooking Show!!",
        repository: alwaysFreeRepository,
      });

      expect(slug).to.equal('georges-cooking-show');
    });

    it('collapses repeated whitespace into a single hyphen and trims leading/trailing hyphens', async () => {
      const slug = await generateUniqueSlug({
        title: '  Multiple   Spaces  ',
        repository: alwaysFreeRepository,
      });

      expect(slug).to.equal('multiple-spaces');
    });

    it('appends a random suffix when the base slug is shorter than 5 characters', async () => {
      const slug = await generateUniqueSlug({ title: 'Hi', repository: alwaysFreeRepository });

      expect(slug.startsWith('hi-')).to.equal(true);
      expect(slug.length).to.be.greaterThan('hi-'.length);
    });

    it('caps the slug at 50 characters for a title at the 100-character maximum', async () => {
      const longTitle = 'a'.repeat(100);

      const slug = await generateUniqueSlug({ title: longTitle, repository: alwaysFreeRepository });

      expect(slug.length).to.be.at.most(50);
    });

    it('caps the slug at 50 characters even when a random suffix has to be appended', async () => {
      let callCount = 0;
      const takenLongTitleRepository = {
        findOne: async () => null,
        raw: () => ({
          findOne: async () => {
            callCount += 1;
            // the bare (truncated) base candidate is taken, forcing the suffix path
            return callCount === 1 ? { slug: 'taken' } : null;
          },
        }),
      };

      const slug = await generateUniqueSlug({
        title: 'a'.repeat(100),
        repository: takenLongTitleRepository,
      });

      expect(slug.length).to.be.at.most(50);
    });

    it('appends a random suffix when the base slug is already taken', async () => {
      let callCount = 0;
      const takenOnceRepository = {
        findOne: async () => null,
        raw: () => ({
          findOne: async () => {
            callCount += 1;
            // first lookup (the bare base slug) is taken, every retry afterwards is free
            return callCount === 1 ? { slug: 'george-cooks' } : null;
          },
        }),
      };

      const slug = await generateUniqueSlug({
        title: 'George Cooks',
        repository: takenOnceRepository,
      });

      expect(slug.startsWith('george-cooks-')).to.equal(true);
      expect(slug).to.not.equal('george-cooks');
    });
  });

  describe('slugExists', () => {
    it('returns true when a matching active record is found', async () => {
      const repository = { findOne: async () => ({ slug: 'taken' }) };

      expect(await slugExists({ repository, slug: 'taken' })).to.equal(true);
    });

    it('returns false when no matching active record is found', async () => {
      const repository = { findOne: async () => null };

      expect(await slugExists({ repository, slug: 'free' })).to.equal(false);
    });

    it('checks soft-deleted records too when includeDeleted is true', async () => {
      const repository = {
        findOne: async () => null,
        raw: () => ({ findOne: async () => ({ slug: 'soft-deleted', deleted: 123 }) }),
      };

      expect(await slugExists({ repository, slug: 'soft-deleted', includeDeleted: true })).to.equal(
        true
      );
    });
  });

  describe('serializeCreatorCard', () => {
    const baseCard = {
      _id: '01JG8XYZA2B3C4D5E6F7G8H9J0',
      title: 'George Cooks',
      description: 'Weekly cooking podcast',
      slug: 'george-cooks',
      creator_reference: 'crt_8f2k1m9x4p7w3q5z',
      links: [],
      service_rates: null,
      status: 'published',
      access_type: 'public',
      access_code: null,
      created: 1767052800000,
      updated: 1767052800000,
    };

    it('maps _id to id and never leaks _id', () => {
      const result = serializeCreatorCard(baseCard);

      expect(result.id).to.equal(baseCard._id);
      expect(result).to.not.have.property('_id');
    });

    it('serializes deleted as null when the underlying value is 0 (paranoid default)', () => {
      const result = serializeCreatorCard({ ...baseCard, deleted: 0 });

      expect(result.deleted).to.equal(null);
    });

    it('preserves a real deleted timestamp', () => {
      const result = serializeCreatorCard({ ...baseCard, deleted: 1767139200000 });

      expect(result.deleted).to.equal(1767139200000);
    });

    it('includes access_code by default', () => {
      const result = serializeCreatorCard({ ...baseCard, access_code: 'A1B2C3' });

      expect(result.access_code).to.equal('A1B2C3');
    });

    it('omits access_code when hideAccessCode is true', () => {
      const result = serializeCreatorCard(
        { ...baseCard, access_code: 'A1B2C3' },
        { hideAccessCode: true }
      );

      expect(result).to.not.have.property('access_code');
    });

    it('returns null when given no card', () => {
      expect(serializeCreatorCard(null)).to.equal(null);
    });
  });
});
