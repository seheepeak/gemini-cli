/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  type Checkpoint,
  encodeTagName,
  decodeTagName,
} from '@google/gemini-cli-core';
import type { Content } from '@google/genai';
import type {
  Command,
  CommandContext,
  CommandExecutionResponse,
} from './types.js';

const CHAT_PREFIX = 'acp-chat-';
const CHAT_SUFFIX = '.json';

function chatFilePath(geminiDir: string, tag: string): string {
  return path.join(
    geminiDir,
    `${CHAT_PREFIX}${encodeTagName(tag)}${CHAT_SUFFIX}`,
  );
}

function parseTag(
  args: string[],
  commandName: string,
  subCommand: string,
): CommandExecutionResponse | string {
  const tag = args.join(' ').trim();
  if (!tag) {
    return {
      name: commandName,
      data: `Missing tag. Usage: /chat ${subCommand} <tag>`,
    };
  }
  return tag;
}

export class ChatCommand implements Command {
  readonly name = 'chat';
  readonly description =
    'Manage saved conversations (save, resume, list, delete, clear).';
  readonly subCommands = [
    new ListChatCommand(),
    new SaveChatCommand(),
    new ResumeChatCommand(),
    new DeleteChatCommand(),
    new ClearChatCommand(),
  ];

  async execute(
    context: CommandContext,
    args: string[],
  ): Promise<CommandExecutionResponse> {
    return this.subCommands[0].execute(context, args);
  }
}

export class ListChatCommand implements Command {
  readonly name = 'chat list';
  readonly description = 'List saved conversations.';

  async execute(
    context: CommandContext,
    _args: string[] = [],
  ): Promise<CommandExecutionResponse> {
    const geminiDir = context.config.storage.getProjectTempDir();

    try {
      const files = await fs.readdir(geminiDir);
      const matchingFiles = files.filter(
        (file) => file.startsWith(CHAT_PREFIX) && file.endsWith(CHAT_SUFFIX),
      );

      const tags = matchingFiles.map((file) => {
        const tagName = file.slice(CHAT_PREFIX.length, -CHAT_SUFFIX.length);
        return decodeTagName(tagName);
      });

      return {
        name: this.name,
        data: tags.join(', '),
      };
    } catch {
      return {
        name: this.name,
        data: '',
      };
    }
  }
}

export class SaveChatCommand implements Command {
  readonly name = 'chat save';
  readonly description =
    'Save the current conversation. Usage: /chat save <tag>';
  readonly arguments = [
    { name: 'tag', description: 'Name for the conversation', isRequired: true },
  ];

  async execute(
    context: CommandContext,
    args: string[],
  ): Promise<CommandExecutionResponse> {
    const result = parseTag(args, this.name, 'save');
    if (typeof result !== 'string') return result;
    const tag = result;

    const history = context.config.geminiClient.getChat().getHistory();
    const geminiDir = context.config.storage.getProjectTempDir();
    const authType = context.config.getContentGeneratorConfig()?.authType;
    const checkpoint: Checkpoint = { history, authType };
    await fs.writeFile(
      chatFilePath(geminiDir, tag),
      JSON.stringify(checkpoint, null, 2),
      'utf-8',
    );

    return {
      name: this.name,
      data: `Conversation saved with tag: ${tag}.`,
    };
  }
}

export class ResumeChatCommand implements Command {
  readonly name = 'chat resume';
  readonly aliases = ['chat load'];
  readonly description = 'Resume a conversation. Usage: /chat resume <tag>';
  readonly arguments = [
    {
      name: 'tag',
      description: 'Name of the conversation to resume',
      isRequired: true,
    },
  ];

  async execute(
    context: CommandContext,
    args: string[],
  ): Promise<CommandExecutionResponse> {
    const result = parseTag(args, this.name, 'resume');
    if (typeof result !== 'string') return result;
    const tag = result;

    const geminiDir = context.config.storage.getProjectTempDir();
    const filePath = chatFilePath(geminiDir, tag);

    let checkpoint: Checkpoint;
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(fileContent);

      if (Array.isArray(parsed)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        checkpoint = { history: parsed as Content[] };
      } else if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'history' in parsed
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        checkpoint = parsed as Checkpoint;
      } else {
        return {
          name: this.name,
          data: `Saved conversation has an unknown format.`,
        };
      }
    } catch {
      return {
        name: this.name,
        data: `No saved conversation found with tag: ${tag}.`,
      };
    }

    const currentAuthType =
      context.config.getContentGeneratorConfig()?.authType;
    if (
      checkpoint.authType &&
      currentAuthType &&
      checkpoint.authType !== currentAuthType
    ) {
      return {
        name: this.name,
        data: `Cannot resume conversation. It was saved with a different authentication method (${checkpoint.authType}) than the current one (${currentAuthType}).`,
      };
    }

    context.config.geminiClient.setHistory(checkpoint.history);

    const messageCount = checkpoint.history.length;
    return {
      name: this.name,
      data: `Resumed conversation "${tag}" with ${messageCount} message(s).`,
    };
  }
}

export class DeleteChatCommand implements Command {
  readonly name = 'chat delete';
  readonly description =
    'Delete a saved conversation. Usage: /chat delete <tag>';
  readonly arguments = [
    {
      name: 'tag',
      description: 'Name of the conversation to delete',
      isRequired: true,
    },
  ];

  async execute(
    context: CommandContext,
    args: string[],
  ): Promise<CommandExecutionResponse> {
    const result = parseTag(args, this.name, 'delete');
    if (typeof result !== 'string') return result;
    const tag = result;

    const geminiDir = context.config.storage.getProjectTempDir();
    const filePath = chatFilePath(geminiDir, tag);

    try {
      await fs.unlink(filePath);
      return {
        name: this.name,
        data: `Saved conversation '${tag}' has been deleted.`,
      };
    } catch {
      return {
        name: this.name,
        data: `No saved conversation found with tag '${tag}'.`,
      };
    }
  }
}

export class ClearChatCommand implements Command {
  readonly name = 'chat clear';
  readonly description = 'Clear the current conversation history.';

  async execute(
    context: CommandContext,
    _args: string[],
  ): Promise<CommandExecutionResponse> {
    context.config.geminiClient.setHistory([]);

    return {
      name: this.name,
      data: 'Conversation history cleared.',
    };
  }
}
