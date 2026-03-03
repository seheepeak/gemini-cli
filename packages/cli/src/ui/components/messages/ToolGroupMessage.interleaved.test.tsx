/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../../test-utils/render.js';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ToolGroupMessage } from './ToolGroupMessage.js';
import type {
  HistoryItem,
  HistoryItemWithoutId,
  IndividualToolCallDisplay,
} from '../../types.js';
import {
  makeFakeConfig,
  CoreToolCallStatus,
  READ_FILE_DISPLAY_NAME,
} from '@google/gemini-cli-core';
import os from 'node:os';
import { createMockSettings } from '../../../test-utils/settings.js';

describe('<ToolGroupMessage /> - Interleaved Output', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createToolCall = (
    overrides: Partial<IndividualToolCallDisplay> = {},
  ): IndividualToolCallDisplay => ({
    callId: `tool-${Math.random().toString(36).substring(7)}`,
    name: 'test-tool',
    description: 'A tool for testing',
    resultDisplay: 'Test result',
    status: CoreToolCallStatus.Success,
    confirmationDetails: undefined,
    renderOutputAsMarkdown: false,
    ...overrides,
  });

  const baseProps = {
    terminalWidth: 80,
  };

  const createItem = (
    tools: IndividualToolCallDisplay[],
  ): HistoryItem | HistoryItemWithoutId => ({
    id: 1,
    type: 'tool_group',
    tools,
  });

  const baseMockConfig = makeFakeConfig({
    model: 'gemini-pro',
    targetDir: os.tmpdir(),
    debugMode: false,
    folderTrust: false,
    ideMode: false,
    enableInteractiveShell: true,
  });

  const compactSettings = createMockSettings({
    merged: {
      ui: { compactToolOutput: true },
    },
  });

  const standardSettings = createMockSettings({
    merged: {
      ui: { compactToolOutput: false },
    },
  });

  it('renders [Standard tool view, Compact tool view, Compact tool view, Standard tool view] sequence with correct borders and spacing', async () => {
    const toolCalls = [
      createToolCall({
        name: 'standard-tool-1',
        resultDisplay: 'Standard result 1',
      }),
      createToolCall({
        name: READ_FILE_DISPLAY_NAME,
        resultDisplay: 'Compact result 1',
      }),
      createToolCall({
        name: READ_FILE_DISPLAY_NAME,
        resultDisplay: 'Compact result 2',
      }),
      createToolCall({
        name: 'standard-tool-2',
        resultDisplay: 'Standard result 2',
      }),
    ];
    const item = createItem(toolCalls);

    const { lastFrame, unmount, waitUntilReady } = renderWithProviders(
      <ToolGroupMessage {...baseProps} item={item} toolCalls={toolCalls} />,
      {
        config: baseMockConfig,
        settings: compactSettings,
        uiState: {
          pendingHistoryItems: [
            {
              type: 'tool_group',
              tools: toolCalls,
            },
          ],
        },
      },
    );

    await waitUntilReady();
    const output = lastFrame({ allowEmpty: true });

    // Check that all components are rendered
    expect(output).toContain('standard-tool-1');
    expect(output).toContain('Compact result 1');
    expect(output).toContain('Compact result 2');
    expect(output).toContain('standard-tool-2');

    // Check borders and spacing using snapshot
    expect(output).toMatchSnapshot();
    unmount();
  });

  it('renders [Standard tool view, Standard tool view] in compact tool view mode (separate segments)', async () => {
    const toolCalls = [
      createToolCall({
        name: 'standard-tool-1',
        resultDisplay: 'Standard result 1',
      }),
      createToolCall({
        name: 'standard-tool-2',
        resultDisplay: 'Standard result 2',
      }),
    ];
    const item = createItem(toolCalls);

    const { lastFrame, unmount, waitUntilReady } = renderWithProviders(
      <ToolGroupMessage {...baseProps} item={item} toolCalls={toolCalls} />,
      {
        config: baseMockConfig,
        settings: compactSettings,
        uiState: {
          pendingHistoryItems: [
            {
              type: 'tool_group',
              tools: toolCalls,
            },
          ],
        },
      },
    );

    await waitUntilReady();
    expect(lastFrame({ allowEmpty: true })).toMatchSnapshot();
    unmount();
  });

  it('renders [Standard tool view, Standard tool view] in standard tool view mode (grouped)', async () => {
    const toolCalls = [
      createToolCall({
        name: 'standard-tool-1',
        resultDisplay: 'Standard result 1',
      }),
      createToolCall({
        name: 'standard-tool-2',
        resultDisplay: 'Standard result 2',
      }),
    ];
    const item = createItem(toolCalls);

    const { lastFrame, unmount, waitUntilReady } = renderWithProviders(
      <ToolGroupMessage {...baseProps} item={item} toolCalls={toolCalls} />,
      {
        config: baseMockConfig,
        settings: standardSettings,
        uiState: {
          pendingHistoryItems: [
            {
              type: 'tool_group',
              tools: toolCalls,
            },
          ],
        },
      },
    );

    await waitUntilReady();
    expect(lastFrame({ allowEmpty: true })).toMatchSnapshot();
    unmount();
  });

  it('renders [Standard tool view, Standard tool view] in compact tool view mode with borderTop=false and borderBottom=false', async () => {
    const toolCalls = [
      createToolCall({
        name: 'standard-tool-1',
        resultDisplay: 'Standard result 1',
      }),
      createToolCall({
        name: 'standard-tool-2',
        resultDisplay: 'Standard result 2',
      }),
    ];
    const item = createItem(toolCalls);

    const { lastFrame, unmount, waitUntilReady } = renderWithProviders(
      <ToolGroupMessage
        {...baseProps}
        item={item}
        toolCalls={toolCalls}
        borderTop={false}
        borderBottom={false}
      />,
      {
        config: baseMockConfig,
        settings: compactSettings,
        uiState: {
          pendingHistoryItems: [
            {
              type: 'tool_group',
              tools: toolCalls,
            },
          ],
        },
      },
    );

    await waitUntilReady();
    expect(lastFrame({ allowEmpty: true })).toMatchSnapshot();
    unmount();
  });
});
