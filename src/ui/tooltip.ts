import * as vscode from 'vscode';
import { CursorPulseConfig, CursorPulseViewState } from '../client/types';
import { buildTooltipMarkdown } from './tooltipContent';

export function renderTooltip(state: CursorPulseViewState, config: CursorPulseConfig): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString(buildTooltipMarkdown(state, config), true);
  markdown.isTrusted = false;
  return markdown;
}
