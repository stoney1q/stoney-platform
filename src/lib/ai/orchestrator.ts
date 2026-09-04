// src/lib/ai/orchestrator.ts

import { getInventoryTools } from './tools/inventory';
import { getRepairTools } from './tools/repairs';

export interface TrustedAIContext {
  userId: string;
  branchId: string;
  branchName: string;
  permissions: string[];
}

/**
 * Assembles the allowed tools for a user based on their active permissions.
 * Tools are bound to the trusted branchId via closure to prevent branch injection.
 */
export function getPermittedTools(context: TrustedAIContext) {
  const tools: import('ai').ToolSet = {};

  // Inventory Tools -> requires 'inventory:read'
  if (context.permissions.includes('inventory:read') || context.permissions.includes('admin:global')) {
    const inventoryTools = getInventoryTools(context.branchId);
    Object.assign(tools, inventoryTools);
  }

  // Repair Tools -> requires 'repairs:read'
  if (context.permissions.includes('repairs:read') || context.permissions.includes('admin:global')) {
    const repairTools = getRepairTools(context.branchId);
    Object.assign(tools, repairTools);
  }

  return tools;
}

export function buildSystemPrompt(context: TrustedAIContext): string {
  return `You are Stoney Co-Pilot, an operational AI assistant.
Your current context is bound to branch: ${context.branchName}.
You only have access to information within this branch.
Do not attempt to provide data for other branches or fabricate business data.
When providing diagnostics or low stock alerts, present the information clearly and concisely.`;
}
