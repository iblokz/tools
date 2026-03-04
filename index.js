#!/usr/bin/env node
/**
 * iblokz-tools CLI
 * Usage: iblokz-tools <command> [options...]
 *
 * Commands:
 *   mermaid-to-drawio <input.mmd> <output.drawio>  Convert Mermaid erDiagram to draw.io
 */

import { run as mermaidToDrawio } from './lib/mermaid-erd-to-drawio.js';

const COMMANDS = {
  'mermaid-to-drawio': {
    run: mermaidToDrawio,
    usage: 'iblokz-tools mermaid-to-drawio <input.mmd> <output.drawio>',
  },
};

function printUsage() {
  console.error('Usage: iblokz-tools <command> [options...]\n');
  console.error('Commands:');
  for (const [name, { usage }] of Object.entries(COMMANDS)) {
    console.error(`  ${usage}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const rest = args.slice(1);

  if (!command || command === '-h' || command === '--help') {
    printUsage();
    process.exit(rest.length ? 1 : 0);
  }

  const cmd = COMMANDS[command];
  if (!cmd) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  if (command === 'mermaid-to-drawio' && rest.length < 2) {
    console.error('mermaid-to-drawio requires <input.mmd> and <output.drawio>');
    console.error(`  ${cmd.usage}`);
    process.exit(1);
  }

  try {
    await cmd.run(...rest);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}

main();
