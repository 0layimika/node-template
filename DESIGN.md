# Design Notes — Creator Card Microservice

A few implementation decisions that weren't fully dictated by the assessment spec, written
down here rather than left implicit.

## `deleted` serializes as `null`, not `0`, for active cards

Mongoose's paranoid-delete plugin (`core/mongoose/database-model.js`) auto-adds a `deleted`
field with `default: 0` on every model, since `0` is what makes the "not deleted" filter
(`query.deleted = 0`) cheap to index and query. The API contract, however, specifies
`deleted: number | null`, with `null` for an active card. `services/creator-cards/helpers.js`'s
`serializeCreatorCard` coerces this explicitly (`deleted: deleted || null`) so the internal
storage representation never leaks into the public response shape.

## A slug stays reserved after a card is soft-deleted

`slugExists` always checks with `includeDeleted: true`, and the `slug` field's unique index is
not scoped to `deleted`. This means a slug can never be reused once claimed, even after its
card is deleted. That's intentional: soft-delete exists so a card can be recovered, and
recovery only makes sense if the card's original slug is still exclusively its own when it
comes back. Freeing the slug on delete would make "undelete" lossy.

## Deleting with the wrong `creator_reference` returns `NF01`, not a `403`

The spec only defines `creator_reference` as a required, 20-character field on delete — it
doesn't say what happens if the value doesn't match the card's owner. We added that check as
additional business logic (the field would otherwise be pointless to require). It deliberately
returns the same `NF01` / `404` as "slug doesn't exist," rather than a `403`, for the same
reason GitHub returns `404` for a private repo you can't see: revealing "a card exists here,
you're just not its owner" via a distinct status would let a caller enumerate valid slugs by
brute-forcing `creator_reference` values and watching for a different response. This also keeps
us inside the assessment's documented closed set of business codes rather than inventing a new
one for an edge case the spec didn't anticipate.

## Trust model: `creator_reference` is a de facto ownership credential

There's no authentication on this service by design (per the assessment's explicit "no auth"
requirement). That means `creator_reference` is effectively the only thing standing between any
caller and deleting someone else's card — anyone who knows (or guesses) a card's
`creator_reference` can delete it. This is a known, accepted limitation given the constraints
of the assessment, not an oversight; a production version of this service would need a real
auth/ownership layer, and `creator_reference` would stop being a secret.

## Verified, not vulnerable: query-string bracket notation on `access_code`

Express's default query parser (`qs`) turns `?access_code[$ne]=1` into an object rather than a
string. This was checked directly: `get-creator-card.js`'s VSL spec declares `access_code` as
`string<trim|length:6>`, and VSL's type validation rejects non-string input before any of the
service's business logic — and before the value ever reaches a database query — runs. No
additional guard was added for this, since one would be dead code; the validator-first
convention already closes it off.
