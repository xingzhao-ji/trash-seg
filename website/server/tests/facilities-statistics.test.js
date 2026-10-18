const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('monthly overflow statistics exclude reports older than one calendar month', async () => {
  const now = '2026-10-18T12:00:00Z';
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
  }
  let monthlyQuery;
  let problemUpdates = 0;
  const reports = Array.from({ length: 4 }, () => ({ createdAt: new Date('2026-09-14T12:00:00Z') }));
  const models = {
    mongoose: {},
    '../models/Bin': { findById: async () => ({ name: 'Synthetic bin' }) },
    '../models/ProblemBin': { findOneAndUpdate: async () => { problemUpdates++; } },
    '../models/FullnessReport': {
      forBin: binId => ({ bin: binId }),
      find: async () => [{ level: 'Empty', createdAt: new Date(now) }],
      countDocuments: async query => {
        monthlyQuery = query;
        return reports.filter(report => report.createdAt >= query.createdAt.$gte).length;
      },
    },
  };
  const module = { exports: {} };
  const source = readFileSync(path.join(__dirname, '../services/facilitiesIntegration.js'), 'utf8');
  vm.runInNewContext(source, { module, Date: FixedDate, console, require(name) {
    assert.ok(name in models, `Unexpected dependency ${name}`);
    return models[name];
  } });
  await module.exports.updateBinStatistics('synthetic-bin');
  assert.equal(monthlyQuery.createdAt.$gte.toISOString(), '2026-09-18T12:00:00.000Z');
  assert.equal(problemUpdates, 0, 'old overflow reports must not flag the bin');
});
