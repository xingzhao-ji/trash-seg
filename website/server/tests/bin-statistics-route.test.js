const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('bin stats route counts only the current calendar month window', async () => {
  const now = '2026-10-18T12:00:00Z';
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
  }
  const routes = new Map();
  const app = { use() {}, get(route, handler) { routes.set(route, handler); }, post() {} };
  const express = () => app;
  express.json = () => () => {};
  let monthlyQuery;
  const oldOverflow = { createdAt: new Date('2026-09-14T12:00:00Z') };
  const dependencies = {
    express, cors: () => () => {}, dotenv: { config() {} },
    // Do not run startup callbacks or connect to a database.
    mongoose: { connect: () => ({ then: () => ({ catch() {} }) }) },
    './models/Bin': { findById: async () => ({ _id: 'fixture-bin', name: 'Fixture', fullness: 25 }) },
    './models/FullnessReport': {
      forBin: bin => ({ bin }), find: async () => [],
      countDocuments: async query => {
        if (!query.level) return 0;
        monthlyQuery = query;
        return oldOverflow.createdAt >= query.createdAt.$gte ? 1 : 0;
      },
    },
    './models/Station': {}, './models/OverviewStat': {}, './models/ProblemBin': {},
    './models/StudentImpact': {}, './services/facilitiesIntegration': {},
  };
  const filename = path.join(__dirname, '../server.js');
  vm.runInNewContext(readFileSync(filename, 'utf8'), {
    process: { env: { MONGODB_URI: 'mongodb://synthetic.invalid/test' } }, Date: FixedDate, console, __dirname: path.dirname(filename),
    require(name) {
      if (name in dependencies) return dependencies[name];
      if (['fs', 'os', 'path', 'child_process'].includes(name)) return require(name);
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename });
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await routes.get('/api/bins/:id/stats')({ params: { id: 'fixture-bin' } }, res);
  assert.equal(res.code, 200);
  assert.equal(monthlyQuery.createdAt.$gte.toISOString(), '2026-09-18T12:00:00.000Z');
  assert.equal(res.body.overflowsThisMonth, 0);
});
