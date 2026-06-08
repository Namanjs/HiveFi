import { logger } from "../services/logger";
import { generateKey, revokeKey, listKeys } from '../services/keyManager';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  try {
    if (command === 'generate') {
      const nameIndex = args.indexOf('--name');
      const name = nameIndex !== -1 ? args[nameIndex + 1] : 'Unnamed Agent';
      const key = await generateKey(name);
      logger.info(`Generated new API key for "${name}":`);
      logger.info(key);
      logger.info(`\nPlease save this key. It will not be shown again.`);
    } else if (command === 'revoke') {
      const keyIndex = args.indexOf('--key');
      if (keyIndex === -1 || !args[keyIndex + 1]) {
        logger.error('Please provide a key to revoke using --key <key>');
        process.exit(1);
      }
      const key = args[keyIndex + 1];
      await revokeKey(key);
      logger.info(`Revoked API key: ${key}`);
    } else if (command === 'list') {
      const keys = await listKeys();
      logger.info('API Keys:');
      console.table(Object.entries(keys).map(([maskedKey, meta]: any) => ({
        Key: maskedKey,
        Name: meta.name,
        Active: meta.isActive,
        Created: new Date(meta.createdAt).toLocaleString()
      })));
    } else {
      logger.info('Usage:');
      logger.info('  npx ts-node server/scripts/manage-keys.ts generate --name "Agent Name"');
      logger.info('  npx ts-node server/scripts/manage-keys.ts revoke --key "hivefi-..."');
      logger.info('  npx ts-node server/scripts/manage-keys.ts list');
    }
  } catch (error) {
    logger.error('Error:', error);
  }
}

main();
