#!/usr/bin/env node
/**
 * OMNIUM CLI
 *
 * Interactive command-line interface for the OMNIUM meta-currency framework.
 *
 * "What if money could remember what it's for?"
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createLedger, OmniumLedger } from '../engine/ledger.js';
import { TemporalStratum } from '../core/types.js';
import { unitSummary } from '../core/omnium.js';
import { describeTemporality } from '../layers/temporal.js';
import { summarizeProvenance, getReputationScore } from '../layers/reputation.js';
import { getQueryEngine } from '../query/engine.js';
import { getQueryStore } from '../query/store.js';

// Global ledger instance
let ledger: OmniumLedger;

// Current "active" wallet for convenience
let activeWalletId: string | null = null;

const program = new Command();

program
  .name('omnium')
  .description('OMNIUM - A Universal Currency Framework')
  .version('0.1.0');

// =============================================================================
// WALLET COMMANDS
// =============================================================================

program
  .command('create-wallet <name>')
  .description('Create a new wallet')
  .action((name: string) => {
    const wallet = ledger.wallets.createWallet(name);
    activeWalletId = wallet.id;
    console.log(chalk.green(`✓ Created wallet: ${name}`));
    console.log(chalk.gray(`  ID: ${wallet.id}`));
    console.log(chalk.gray(`  (Set as active wallet)`));
  });

program
  .command('wallets')
  .description('List all wallets')
  .action(() => {
    const wallets = ledger.wallets.getAllWallets();
    if (wallets.length === 0) {
      console.log(chalk.yellow('No wallets yet. Create one with: create-wallet <name>'));
      return;
    }
    console.log(chalk.bold('\nWallets:'));
    for (const w of wallets) {
      const balance = ledger.wallets.getBalance(w.id);
      const active = w.id === activeWalletId ? chalk.green(' ← active') : '';
      console.log(`  ${w.name} (${w.id.slice(0, 8)}...) - ${balance.total.toFixed(2)}Ω${active}`);
    }
    console.log();
  });

program
  .command('use <walletName>')
  .description('Set active wallet by name')
  .action((walletName: string) => {
    const wallets = ledger.wallets.getAllWallets();
    const wallet = wallets.find(
      (w) => w.name.toLowerCase() === walletName.toLowerCase()
    );
    if (!wallet) {
      console.log(chalk.red(`Wallet not found: ${walletName}`));
      return;
    }
    activeWalletId = wallet.id;
    console.log(chalk.green(`✓ Active wallet: ${wallet.name}`));
  });

program
  .command('balance')
  .description('Show balance of active wallet')
  .action(() => {
    if (!activeWalletId) {
      console.log(chalk.yellow('No active wallet. Use: create-wallet <name>'));
      return;
    }
    console.log(ledger.wallets.walletStatus(activeWalletId));
  });

// =============================================================================
// MINTING & TRANSFERS
// =============================================================================

program
  .command('mint <amount>')
  .description('Mint new Ω from Commons Pool (admin)')
  .option('-w, --wallet <id>', 'Target wallet ID (default: active wallet)')
  .option('-n, --note <note>', 'Note for provenance')
  .action((amountStr: string, options: { wallet?: string; note?: string }) => {
    const walletId = options.wallet ?? activeWalletId;
    if (!walletId) {
      console.log(chalk.yellow('No wallet specified. Use: create-wallet <name>'));
      return;
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.log(chalk.red('Invalid amount'));
      return;
    }

    try {
      const unit = ledger.mint(amount, walletId, options.note);
      console.log(chalk.green(`✓ Minted ${amount.toFixed(2)}Ω`));
      console.log(chalk.gray(`  Unit ID: ${unit.id.slice(0, 8)}...`));
      console.log(chalk.gray(`  ${unitSummary(unit)}`));
    } catch (err) {
      console.log(chalk.red(`Error: ${(err as Error).message}`));
    }
  });

program
  .command('transfer <unitId> <toWallet> [amount]')
  .description('Transfer Ω to another wallet')
  .option('-n, --note <note>', 'Note for provenance (marks as "earned")')
  .action(
    (
      unitId: string,
      toWallet: string,
      amountStr: string | undefined,
      options: { note?: string }
    ) => {
      // Find wallet by name or ID
      const wallets = ledger.wallets.getAllWallets();
      const targetWallet = wallets.find(
        (w) =>
          w.name.toLowerCase() === toWallet.toLowerCase() ||
          w.id.startsWith(toWallet)
      );
      if (!targetWallet) {
        console.log(chalk.red(`Wallet not found: ${toWallet}`));
        return;
      }

      // Find unit by ID prefix
      const units = ledger.wallets.getAllUnits();
      const unit = units.find((u) => u.id.startsWith(unitId));
      if (!unit) {
        console.log(chalk.red(`Unit not found: ${unitId}`));
        return;
      }

      const amount = amountStr ? parseFloat(amountStr) : undefined;

      const result = ledger.transfer(unit.id, targetWallet.id, amount, options.note);
      if (result.success) {
        console.log(
          chalk.green(
            `✓ Transferred ${(amount ?? unit.magnitude).toFixed(2)}Ω to ${targetWallet.name}`
          )
        );
      } else {
        console.log(chalk.red(`Error: ${result.error}`));
      }
    }
  );

// =============================================================================
// CONVERSION
// =============================================================================

program
  .command('convert <unitId>')
  .description('Convert a unit to different dimensions')
  .option('-t, --temporal <stratum>', 'Target temporal stratum (T0, T1, T2, T∞)')
  .option('-l, --add-local <community>', 'Add locality (enter community)')
  .option('-L, --remove-local <community>', 'Remove locality (leave community)')
  .option('-p, --add-purpose <purpose>', 'Add purpose coloring')
  .option('-P, --remove-purpose <purpose>', 'Remove purpose coloring')
  .option('--strip-reputation', 'Strip provenance (lose history)')
  .action(
    (
      unitId: string,
      options: {
        temporal?: string;
        addLocal?: string;
        removeLocal?: string;
        addPurpose?: string;
        removePurpose?: string;
        stripReputation?: boolean;
      }
    ) => {
      // Find unit
      const units = ledger.wallets.getAllUnits();
      const unit = units.find((u) => u.id.startsWith(unitId));
      if (!unit) {
        console.log(chalk.red(`Unit not found: ${unitId}`));
        return;
      }

      // Build conversion request
      const request: Parameters<typeof ledger.convert>[1] = {};

      if (options.temporal) {
        const stratum = parseTemporalStratum(options.temporal);
        if (!stratum) {
          console.log(chalk.red(`Invalid temporal stratum: ${options.temporal}`));
          console.log(chalk.gray('Valid: T0, T1, T2, T∞'));
          return;
        }
        request.targetTemporality = stratum;
      }

      if (options.addLocal || options.removeLocal) {
        request.targetLocality = {
          add: options.addLocal ? [options.addLocal] : undefined,
          remove: options.removeLocal ? [options.removeLocal] : undefined,
        };
      }

      if (options.addPurpose || options.removePurpose) {
        request.targetPurpose = {
          add: options.addPurpose ? [options.addPurpose] : undefined,
          remove: options.removePurpose ? [options.removePurpose] : undefined,
        };
      }

      if (options.stripReputation) {
        request.stripReputation = true;
      }

      try {
        const newUnit = ledger.convert(unit.id, request);
        console.log(chalk.green(`✓ Converted unit`));
        console.log(chalk.gray(`  Old: ${unitSummary(unit)}`));
        console.log(chalk.gray(`  New: ${unitSummary(newUnit)}`));
      } catch (err) {
        console.log(chalk.red(`Error: ${(err as Error).message}`));
      }
    }
  );

// =============================================================================
// COMMUNITIES
// =============================================================================

program
  .command('create-community <name>')
  .description('Create a new local currency community')
  .option('-f, --fee <percent>', 'Boundary fee percentage (default: 3)')
  .option('-d, --description <desc>', 'Description')
  .action((name: string, options: { fee?: string; description?: string }) => {
    const fee = options.fee ? parseFloat(options.fee) / 100 : 0.03;
    const community = ledger.communities.createCommunity({
      name,
      description: options.description,
      boundaryFee: fee,
    });
    console.log(chalk.green(`✓ Created community: ${name}`));
    console.log(chalk.gray(`  ID: ${community.id}`));
    console.log(chalk.gray(`  Boundary fee: ${(fee * 100).toFixed(1)}%`));
  });

program
  .command('communities')
  .description('List all communities')
  .action(() => {
    console.log(ledger.communities.listCommunities());
  });

program
  .command('join <community>')
  .description('Join a community with active wallet')
  .action((communityName: string) => {
    if (!activeWalletId) {
      console.log(chalk.yellow('No active wallet'));
      return;
    }
    const community = ledger.communities.getCommunityByName(communityName);
    if (!community) {
      console.log(chalk.red(`Community not found: ${communityName}`));
      return;
    }
    ledger.wallets.joinCommunity(activeWalletId, community.id);
    ledger.communities.addMember(community.id);
    console.log(chalk.green(`✓ Joined community: ${community.name}`));
  });

// =============================================================================
// PURPOSES
// =============================================================================

program
  .command('purposes')
  .description('List all purpose channels')
  .action(() => {
    console.log(ledger.purposes.listPurposes());
  });

program
  .command('register-purpose <purpose>')
  .description('Register active wallet for a purpose channel')
  .action((purposeName: string) => {
    if (!activeWalletId) {
      console.log(chalk.yellow('No active wallet'));
      return;
    }
    const purpose = ledger.purposes.getPurpose(purposeName);
    if (!purpose) {
      console.log(chalk.red(`Purpose not found: ${purposeName}`));
      return;
    }
    ledger.purposes.registerRecipient(purpose.id, activeWalletId);
    ledger.wallets.registerPurpose(activeWalletId, purpose.id);
    console.log(chalk.green(`✓ Registered for purpose: ${purpose.name}`));
  });

// =============================================================================
// TIME & TEMPORAL
// =============================================================================

program
  .command('tick [days]')
  .description('Advance time and apply demurrage/dividends')
  .action((daysStr?: string) => {
    const days = daysStr ? parseFloat(daysStr) : 1;
    const result = ledger.tick(days);
    console.log(chalk.blue(`⏱ Advanced ${days} day(s)`));
    console.log(chalk.gray(`  Units updated: ${result.updated}`));
    if (result.totalDemurrage > 0) {
      console.log(chalk.red(`  Demurrage: -${result.totalDemurrage.toFixed(4)}Ω`));
    }
    if (result.totalDividend > 0) {
      console.log(chalk.green(`  Dividends: +${result.totalDividend.toFixed(4)}Ω`));
    }
  });

program
  .command('temporal')
  .description('Show temporal strata descriptions')
  .action(() => {
    console.log(chalk.bold('\nTemporal Strata:\n'));
    for (const stratum of Object.values(TemporalStratum)) {
      console.log(chalk.cyan(`  ${stratum}:`), describeTemporality(stratum));
    }
    console.log();
  });

// =============================================================================
// PROVENANCE
// =============================================================================

program
  .command('history <unitId>')
  .description('Show provenance history of a unit')
  .action((unitId: string) => {
    const units = ledger.wallets.getAllUnits();
    const unit = units.find((u) => u.id.startsWith(unitId));
    if (!unit) {
      console.log(chalk.red(`Unit not found: ${unitId}`));
      return;
    }
    console.log(summarizeProvenance(unit));
  });

// =============================================================================
// STATUS
// =============================================================================

program
  .command('status')
  .description('Show overall system status')
  .action(() => {
    console.log(ledger.status());
  });

program
  .command('units')
  .description('List all units in active wallet')
  .action(() => {
    if (!activeWalletId) {
      console.log(chalk.yellow('No active wallet'));
      return;
    }
    const units = ledger.wallets.getUnits(activeWalletId);
    if (units.length === 0) {
      console.log(chalk.yellow('No units in wallet'));
      return;
    }
    console.log(chalk.bold(`\nUnits (${units.length}):\n`));
    for (const unit of units) {
      const rep = getReputationScore(unit);
      console.log(
        `  ${chalk.cyan(unit.id.slice(0, 12))}... ` +
          `${chalk.yellow(unit.magnitude.toFixed(2).padStart(10))}Ω ` +
          `[${unit.temporality}] ` +
          `rep:${(rep * 100).toFixed(0)}%`
      );
    }
    console.log();
  });

// =============================================================================
// DEMO / SEED DATA
// =============================================================================

program
  .command('demo')
  .description('Set up demo scenario with sample data')
  .action(() => {
    console.log(chalk.blue('Setting up OMNIUM demo...\n'));

    // Create wallets
    const maya = ledger.wallets.createWallet('Maya');
    const shop = ledger.wallets.createWallet('GreenBike Shop');
    const teacher = ledger.wallets.createWallet('Local Teacher Fund');

    // Create community
    const millbrook = ledger.communities.createCommunity({
      name: 'Millbrook',
      description: 'Local community currency for Millbrook',
      boundaryFee: 0.03,
    });

    // Join community
    ledger.wallets.joinCommunity(maya.id, millbrook.id);
    ledger.wallets.joinCommunity(shop.id, millbrook.id);
    ledger.communities.addMember(millbrook.id);
    ledger.communities.addMember(millbrook.id);

    // Register purposes (IDs are the keys from STANDARD_PURPOSES)
    ledger.purposes.registerRecipient('education', teacher.id);
    ledger.purposes.registerRecipient('carbon', shop.id);
    ledger.wallets.registerPurpose(teacher.id, 'education');
    ledger.wallets.registerPurpose(shop.id, 'carbon');

    // Mint some money
    ledger.mint(1000, maya.id, 'Initial allocation');

    activeWalletId = maya.id;

    console.log(chalk.green('✓ Created wallets: Maya, GreenBike Shop, Local Teacher Fund'));
    console.log(chalk.green('✓ Created community: Millbrook'));
    console.log(chalk.green('✓ Registered purpose recipients'));
    console.log(chalk.green('✓ Minted 1000Ω to Maya'));
    console.log(chalk.gray('\nActive wallet: Maya'));
    console.log(chalk.gray('\nTry these commands:'));
    console.log(chalk.gray('  balance                    - See Maya\'s balance'));
    console.log(chalk.gray('  units                      - List units'));
    console.log(chalk.gray('  convert <id> -t T2         - Lock for generational savings'));
    console.log(chalk.gray('  convert <id> -l Millbrook  - Localize to Millbrook'));
    console.log(chalk.gray('  convert <id> -p carbon     - Color for carbon-negative'));
    console.log(chalk.gray('  tick 365                   - Advance 1 year'));
    console.log(chalk.gray('  status                     - System overview'));
  });

// =============================================================================
// PERSISTENCE
// =============================================================================

program
  .command('save')
  .description('Save current ledger state to disk')
  .action(async () => {
    try {
      if (!ledger.isPersistenceEnabled()) {
        await ledger.enablePersistence();
      }
      const cid = await ledger.save();
      console.log(chalk.green(`✓ Saved snapshot`));
      console.log(chalk.gray(`  CID: ${cid.slice(0, 20)}...`));
    } catch (err) {
      console.log(chalk.red(`Error: ${(err as Error).message}`));
    }
  });

program
  .command('load')
  .description('Load ledger state from disk')
  .action(async () => {
    try {
      const loaded = await ledger.enablePersistence();
      if (loaded) {
        console.log(chalk.green(`✓ Loaded from persistence`));
        const stats = ledger.getPersistenceStats();
        if (stats?.lastSaveTime) {
          console.log(chalk.gray(`  Last saved: ${new Date(stats.lastSaveTime).toISOString()}`));
        }
        console.log(chalk.gray(`  Snapshots: ${stats?.snapshotCount ?? 0}`));

        // Show what was loaded
        const wallets = ledger.wallets.getAllWallets();
        const units = ledger.wallets.getAllUnits();
        console.log(chalk.gray(`  Wallets: ${wallets.length}`));
        console.log(chalk.gray(`  Units: ${units.length}`));
      } else {
        console.log(chalk.yellow('No saved state found. Starting fresh.'));
      }
    } catch (err) {
      console.log(chalk.red(`Error: ${(err as Error).message}`));
    }
  });

program
  .command('persistence-status')
  .description('Show persistence statistics')
  .action(() => {
    if (!ledger.isPersistenceEnabled()) {
      console.log(chalk.yellow('Persistence not enabled. Use: save or load'));
      return;
    }
    const stats = ledger.getPersistenceStats();
    if (!stats) {
      console.log(chalk.yellow('No persistence stats available'));
      return;
    }

    console.log(chalk.bold('\nPersistence Status:\n'));
    console.log(`  Initialized:    ${stats.initialized ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`  Storage Path:   ${stats.storagePath}`);
    console.log(`  Snapshots:      ${stats.snapshotCount}`);
    console.log(`  TX Blocks:      ${stats.transactionBlockCount}`);
    console.log(`  Pending TXs:    ${stats.pendingTransactions}`);
    if (stats.lastSaveTime) {
      console.log(`  Last Saved:     ${new Date(stats.lastSaveTime).toISOString()}`);
    }
    if (stats.cacheStats) {
      const cache = stats.cacheStats;
      console.log(`  Cache Entries:  ${cache.size}/${cache.maxSize}`);
      console.log(`  Cache Hit Rate: ${(cache.hitRate * 100).toFixed(1)}%`);
    }
    console.log();
  });

// =============================================================================
// QUERY COMMANDS
// =============================================================================

const queryEngine = getQueryEngine();
const queryStore = getQueryStore();

program
  .command('q <content...>')
  .description('Submit a query (think of it as asking an AI)')
  .alias('query')
  .action(async (contentParts: string[]) => {
    const content = contentParts.join(' ');
    const userId = queryStore.getUserId();

    console.log(chalk.blue('Processing query...\n'));

    try {
      // Subscribe to progress events
      const unsubscribe = queryEngine.on((event) => {
        if (event.type === 'compute_progress' && event.partial) {
          process.stdout.write(chalk.gray('.'));
        }
      });

      const { query, result } = await queryEngine.query(content, userId, {
        onProgress: () => {
          // Progress handled by event listener
        },
      });

      unsubscribe();
      console.log('\n');

      // Save locally
      queryStore.saveQuery(query);
      queryStore.saveResult(result);

      // Display result
      console.log(chalk.green('Response:'));
      console.log(result.content);
      console.log();

      // Show attestation summary
      console.log(chalk.gray(`Query ID: ${query.id.slice(0, 8)}...`));
      console.log(chalk.gray(`Compute: ${result.metrics.computeUnits} units in ${result.metrics.durationMs}ms`));
      console.log(chalk.gray(`Attestation: ${result.attestation.outputCid.slice(0, 20)}...`));
      console.log();
      console.log(chalk.gray('Share with: share ' + query.id.slice(0, 8)));
    } catch (err) {
      console.log(chalk.red(`Error: ${(err as Error).message}`));
    }
  });

program
  .command('queries')
  .description('List recent queries (local/private)')
  .option('-n, --limit <n>', 'Number of queries to show', '10')
  .action((options: { limit: string }) => {
    const limit = parseInt(options.limit, 10);
    const queries = queryStore.listQueries(limit);

    if (queries.length === 0) {
      console.log(chalk.yellow('No queries yet. Try: q "What is the meaning of life?"'));
      return;
    }

    console.log(chalk.bold(`\nRecent Queries (${queries.length}):\n`));
    for (const query of queries) {
      const result = queryStore.getResultForQuery(query.id);
      const shared = queryStore.isShared(query.id);
      const timestamp = new Date(query.timestamp).toLocaleString();
      const preview = query.content.slice(0, 50) + (query.content.length > 50 ? '...' : '');

      console.log(
        `  ${chalk.cyan(query.id.slice(0, 8))} ` +
          `${chalk.gray(timestamp)} ` +
          (shared ? chalk.green('[shared]') : chalk.gray('[private]'))
      );
      console.log(`    ${preview}`);
      if (result) {
        console.log(chalk.gray(`    → ${result.metrics.computeUnits} compute units`));
      }
      console.log();
    }
  });

program
  .command('query-result <queryId>')
  .description('Show full result for a query')
  .alias('qr')
  .action((queryId: string) => {
    // Find query by prefix
    const queries = queryStore.listQueries(100);
    const query = queries.find((q) => q.id.startsWith(queryId));

    if (!query) {
      console.log(chalk.red(`Query not found: ${queryId}`));
      return;
    }

    const result = queryStore.getResultForQuery(query.id);
    if (!result) {
      console.log(chalk.red('Result not found (computation may have failed)'));
      return;
    }

    console.log(chalk.bold('\nQuery:'));
    console.log(chalk.cyan(query.content));
    console.log();
    console.log(chalk.bold('Response:'));
    console.log(result.content);
    console.log();
    console.log(chalk.bold('Attestation:'));
    console.log(chalk.gray(`  Input CID:  ${result.attestation.inputCid}`));
    console.log(chalk.gray(`  Code CID:   ${result.attestation.codeCid}`));
    console.log(chalk.gray(`  Output CID: ${result.attestation.outputCid}`));
    console.log(chalk.gray(`  Proof:      ${result.attestation.proofMethod}`));
    console.log(chalk.gray(`  Provider:   ${result.attestation.providerId}`));
    console.log();
  });

program
  .command('share <queryId>')
  .description('Share a query/result (makes it discoverable)')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('-v, --visibility <level>', 'Visibility: shared or public', 'shared')
  .action((queryId: string, options: { tags?: string; visibility?: string }) => {
    // Find query by prefix
    const queries = queryStore.listQueries(100);
    const query = queries.find((q) => q.id.startsWith(queryId));

    if (!query) {
      console.log(chalk.red(`Query not found: ${queryId}`));
      return;
    }

    if (queryStore.isShared(query.id)) {
      console.log(chalk.yellow('Already shared'));
      const entry = queryStore.getSharedEntry(query.id);
      if (entry) {
        console.log(chalk.gray(`  Shared at: ${new Date(entry.sharedAt).toLocaleString()}`));
        console.log(chalk.gray(`  Tips: ${entry.value.tips}Ω`));
      }
      return;
    }

    const tags = options.tags?.split(',').map((t) => t.trim());
    const visibility = (options.visibility as 'shared' | 'public') ?? 'shared';

    const entry = queryStore.share(query.id, visibility, tags);
    if (!entry) {
      console.log(chalk.red('Failed to share (result may be missing)'));
      return;
    }

    console.log(chalk.green('✓ Shared query'));
    console.log(chalk.gray(`  Query: ${query.content.slice(0, 40)}...`));
    console.log(chalk.gray(`  Visibility: ${visibility}`));
    if (tags) {
      console.log(chalk.gray(`  Tags: ${tags.join(', ')}`));
    }
    console.log();
    console.log(chalk.blue('Others can now discover and cite your query.'));
    console.log(chalk.blue('If they find it valuable, you\'ll receive tips/attributions.'));
  });

program
  .command('shared')
  .description('List shared entries')
  .option('-n, --limit <n>', 'Number to show', '10')
  .action((options: { limit: string }) => {
    const limit = parseInt(options.limit, 10);
    const entries = queryStore.listShared(limit);

    if (entries.length === 0) {
      console.log(chalk.yellow('Nothing shared yet. Share a query with: share <queryId>'));
      return;
    }

    console.log(chalk.bold(`\nShared Entries (${entries.length}):\n`));
    for (const entry of entries) {
      const preview = entry.query.content.slice(0, 50) + (entry.query.content.length > 50 ? '...' : '');
      const totalValue = entry.value.tips + entry.value.boosts;

      console.log(
        `  ${chalk.cyan(entry.query.id.slice(0, 8))} ` +
          `${chalk.green(`${totalValue.toFixed(2)}Ω`)} ` +
          `${chalk.gray(`(${entry.value.citations} citations, ${entry.value.uses} uses)`)}`
      );
      console.log(`    ${preview}`);
      if (entry.tags?.length) {
        console.log(chalk.gray(`    Tags: ${entry.tags.join(', ')}`));
      }
      console.log();
    }
  });

program
  .command('tip <queryId> <amount>')
  .description('Tip a shared query (attribute value)')
  .option('-n, --note <note>', 'Optional note')
  .action((queryId: string, amountStr: string, options: { note?: string }) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.log(chalk.red('Invalid amount'));
      return;
    }

    // Find by prefix
    const entries = queryStore.listShared(100);
    const entry = entries.find((e) => e.query.id.startsWith(queryId));

    if (!entry) {
      console.log(chalk.red(`Shared entry not found: ${queryId}`));
      return;
    }

    const userId = queryStore.getUserId();
    const success = queryStore.attributeValue(entry.query.id, 'tip', amount, userId);

    if (success) {
      console.log(chalk.green(`✓ Tipped ${amount.toFixed(2)}Ω`));
      console.log(chalk.gray(`  To: ${entry.sharedBy}`));
      console.log(chalk.gray(`  For: ${entry.query.content.slice(0, 40)}...`));
    } else {
      console.log(chalk.red('Failed to tip'));
    }
  });

program
  .command('cite <queryId>')
  .description('Cite a shared query (acknowledge usefulness)')
  .action((queryId: string) => {
    // Find by prefix
    const entries = queryStore.listShared(100);
    const entry = entries.find((e) => e.query.id.startsWith(queryId));

    if (!entry) {
      console.log(chalk.red(`Shared entry not found: ${queryId}`));
      return;
    }

    const userId = queryStore.getUserId();
    const success = queryStore.attributeValue(entry.query.id, 'citation', 1, userId);

    if (success) {
      console.log(chalk.green('✓ Cited'));
      console.log(chalk.gray(`  ${entry.query.content.slice(0, 50)}...`));
    } else {
      console.log(chalk.red('Failed to cite'));
    }
  });

program
  .command('query-stats')
  .description('Show query system statistics')
  .alias('qs')
  .action(() => {
    const stats = queryStore.getStats();

    console.log(chalk.bold('\nQuery System Stats:\n'));
    console.log(`  User ID:          ${chalk.cyan(stats.userId)}`);
    console.log(`  Storage:          ${chalk.gray(stats.storagePath)}`);
    console.log();
    console.log(`  Total Queries:    ${stats.totalQueries}`);
    console.log(`  Total Shared:     ${stats.totalShared}`);
    console.log(`  Compute Units:    ${stats.totalComputeUnits}`);
    console.log(`  Value Received:   ${chalk.green(stats.totalValueReceived.toFixed(2) + 'Ω')}`);
    console.log();
  });

// =============================================================================
// HELPERS
// =============================================================================

function parseTemporalStratum(s: string): TemporalStratum | null {
  const normalized = s.toUpperCase().replace('INFINITY', '∞');
  switch (normalized) {
    case 'T0':
      return TemporalStratum.T0;
    case 'T1':
      return TemporalStratum.T1;
    case 'T2':
      return TemporalStratum.T2;
    case 'T∞':
    case 'TINFINITY':
    case 'TINF':
      return TemporalStratum.TInfinity;
    default:
      return null;
  }
}

// =============================================================================
// MAIN
// =============================================================================

// Initialize ledger
ledger = createLedger();

// Parse and run
program.parse();

// If no command given, show help
if (process.argv.length <= 2) {
  console.log(chalk.bold.blue('\n  OMNIUM - A Universal Currency Framework\n'));
  console.log(chalk.italic('  "What if money could remember what it\'s for?"\n'));
  program.outputHelp();
}
