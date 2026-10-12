const seedDemo = require('./seed-demo');

(async () => {
  if (process.env.SEED_DEMO === '1') await seedDemo();
  require('../server');
})().catch(error => {
  console.error(`Demo startup failed: ${error.message}`);
  process.exitCode = 1;
});
