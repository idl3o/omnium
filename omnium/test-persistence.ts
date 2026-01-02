import { createLedger } from './src/engine/ledger.js';

async function test() {
  console.log('=== Testing Persistence ===\n');

  // Clean start
  const ledger = createLedger();

  // Create some data
  const wallet = ledger.wallets.createWallet('TestWallet');
  ledger.mint(500, wallet.id, 'Test mint');

  console.log('Before save:');
  console.log('  Wallets:', ledger.wallets.getAllWallets().length);
  console.log('  Units:', ledger.wallets.getAllUnits().length);

  // Enable persistence and save
  await ledger.enablePersistence({ storagePath: './.test-omnium-data' });
  const cid = await ledger.save();
  console.log('  Saved CID:', cid.slice(0, 30) + '...');
  await ledger.disablePersistence();

  // Small delay to ensure everything is flushed
  await new Promise(r => setTimeout(r, 1000));

  // Now create a fresh ledger and load
  console.log('\nAfter load (fresh ledger):');
  const ledger2 = createLedger();

  // Debug: Check if manifest can be read
  const fs = await import('fs/promises');
  const manifestPath = './.test-omnium-data/manifest.json';
  try {
    const manifestData = await fs.readFile(manifestPath, 'utf-8');
    console.log('  Manifest file exists:', manifestData.slice(0, 50) + '...');
  } catch (e) {
    console.log('  Manifest read error:', e);
  }

  const loaded = await ledger2.enablePersistence({ storagePath: './.test-omnium-data' });
  console.log('  Loaded from snapshot:', loaded);
  console.log('  Persistence stats:', ledger2.getPersistenceStats());
  console.log('  Wallets:', ledger2.wallets.getAllWallets().length);
  console.log('  Units:', ledger2.wallets.getAllUnits().length);

  const wallets = ledger2.wallets.getAllWallets();
  if (wallets.length > 0) {
    console.log('  First wallet:', wallets[0].name);
  }

  await ledger2.disablePersistence();

  console.log('\n=== Test Complete ===');
}

test().catch(console.error);
