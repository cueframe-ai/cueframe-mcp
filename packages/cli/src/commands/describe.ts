
import type { Command } from 'commander';
import { emitEvent } from '../remote/output.js';

interface DescribedCommand {
  name: string;
  description: string;
  arguments: { name: string; required: boolean; description: string }[];
  options: { flags: string; description: string; default?: unknown }[];
  subcommands?: DescribedCommand[];
}

function describeOne(cmd: Command): DescribedCommand {
  const subcommands = cmd.commands.map(describeOne);
  return {
    name: cmd.name(),
    description: cmd.description(),
    arguments: cmd.registeredArguments.map((a) => ({
      name: a.name(),
      required: a.required,
      description: a.description,
    })),
    options: cmd.options.map((o) => ({
      flags: o.flags,
      description: o.description,
      ...(o.defaultValue !== undefined ? { default: o.defaultValue } : {}),
    })),
    ...(subcommands.length > 0 ? { subcommands } : {}),
  };
}

export function describeCommand(program: Command, opts: { json?: boolean }) {
  const commands = program.commands.map(describeOne);

  if (opts.json) {
    emitEvent(opts, 'describe_complete', {
      name: program.name(),
      version: program.version() ?? null,
      commands,
    });
    return;
  }

  console.log(`${program.name()} ${program.version() ?? ''}`.trim());
  for (const c of commands) {
    console.log(`\n  ${c.name}  —  ${c.description}`);
    for (const sub of c.subcommands ?? []) {
      console.log(`    ${c.name} ${sub.name}  —  ${sub.description}`);
    }
  }
}
