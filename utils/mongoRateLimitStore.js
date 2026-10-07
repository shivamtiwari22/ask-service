import mongoose from "mongoose";

const DEFAULT_COLLECTION = "rate_limit_hits";

/**
 * express-rate-limit store backed by MongoDB so every API instance shares the
 * same counters. Expired windows are reset inside the update itself; the TTL
 * index only cleans up old documents.
 */
export class MongoRateLimitStore {
  constructor({ prefix = "rl:", collectionName = DEFAULT_COLLECTION, getCollection } = {}) {
    this.prefix = prefix;
    this.localKeys = false;
    this.collectionName = collectionName;
    this.getCollection =
      getCollection || (() => mongoose.connection.collection(this.collectionName));
    this.windowMs = 60 * 1000;
    this.ttlIndex = null;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  key(key) {
    return `${this.prefix}${key}`;
  }

  ensureTtlIndex() {
    if (!this.ttlIndex) {
      this.ttlIndex = this.getCollection()
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
        .catch((err) => {
          this.ttlIndex = null;
          throw err;
        });
    }
    return this.ttlIndex;
  }

  async get(key) {
    const doc = await this.getCollection().findOne({ _id: this.key(key) });
    if (!doc || !doc.expiresAt || doc.expiresAt <= new Date()) return undefined;
    return { totalHits: doc.hits, resetTime: doc.expiresAt };
  }

  async increment(key) {
    await this.ensureTtlIndex();
    const now = new Date();
    const resetAt = new Date(now.getTime() + this.windowMs);
    const windowExpired = {
      $or: [{ $not: ["$expiresAt"] }, { $lte: ["$expiresAt", now] }],
    };
    const update = [
      {
        $set: {
          hits: { $cond: [windowExpired, 1, { $add: ["$hits", 1] }] },
          expiresAt: { $cond: [windowExpired, resetAt, "$expiresAt"] },
        },
      },
    ];

    const run = () =>
      this.getCollection().findOneAndUpdate({ _id: this.key(key) }, update, {
        upsert: true,
        returnDocument: "after",
      });

    let result;
    try {
      result = await run();
    } catch (err) {
      // Two instances can race to upsert the same new key; the loser retries as an update.
      if (err?.code !== 11000) throw err;
      result = await run();
    }
    const doc = result && "value" in result && "ok" in result ? result.value : result;
    return { totalHits: doc.hits, resetTime: doc.expiresAt };
  }

  async decrement(key) {
    await this.getCollection().updateOne(
      { _id: this.key(key), hits: { $gt: 0 } },
      { $inc: { hits: -1 } },
    );
  }

  async resetKey(key) {
    await this.getCollection().deleteOne({ _id: this.key(key) });
  }

  async block(key, durationMs) {
    await this.getCollection().updateOne(
      { _id: this.key(`block:${key}`) },
      { $set: { expiresAt: new Date(Date.now() + durationMs) } },
      { upsert: true },
    );
  }

  async isBlocked(key) {
    const doc = await this.getCollection().findOne({ _id: this.key(`block:${key}`) });
    return Boolean(doc?.expiresAt && doc.expiresAt > new Date());
  }
}

export default MongoRateLimitStore;
