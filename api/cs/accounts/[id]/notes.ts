/**
 * Account Notes/Interactions API Endpoint
 * 
 * GET /api/cs/accounts/:id/notes
 *   - Fetches all notes/interactions for an account from Coda
 * 
 * POST /api/cs/accounts/:id/notes
 *   - Creates a new note/interaction in Coda
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Interaction, InteractionType, InteractionChannel } from '../../../../src/lib/types/account';
import { 
  fetchInteractions, 
  createInteraction, 
  codaInteractionToInteraction,
  isCodaConfigured,
  type CodaInteraction,
} from '../../../lib/coda-sync';

// ============================================================================
// Request/Response Types
// ============================================================================

interface CreateInteractionRequest {
  type: InteractionType;
  channel?: InteractionChannel;
  subject?: string;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  nextAction?: string;
  nextActionDate?: string;
  occurredAt?: string;
  createdByName?: string;
}

interface NotesResponse {
  interactions: Interaction[];
  total: number;
  synced: boolean;
}

interface CreateNoteResponse {
  interaction: Interaction;
  synced: boolean;
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Arda-API-Key, X-Arda-Author');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Extract account ID from path
  const { id } = req.query;
  const accountId = Array.isArray(id) ? id[0] : id;
  
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  // Get Coda credentials
  const codaToken = process.env.CODA_API_TOKEN;
  const codaDocId = process.env.CODA_DOC_ID || '0cEU3RTNX6';
  
  if (!isCodaConfigured(codaToken, codaDocId)) {
    return res.status(503).json({ 
      error: 'Coda integration not configured',
      message: 'Set CODA_API_TOKEN and CODA_DOC_ID environment variables',
    });
  }
  
  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, accountId, codaToken!, codaDocId!);
      case 'POST':
        return await handlePost(req, res, accountId, codaToken!, codaDocId!);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Notes API error:', error);
    return res.status(500).json({
      error: 'Failed to process request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// GET Handler - Fetch Interactions
// ============================================================================

async function handleGet(
  _req: VercelRequest,
  res: VercelResponse,
  accountId: string,
  codaToken: string,
  codaDocId: string
): Promise<void> {
  try {
    // Fetch interactions from Coda
    const codaInteractions = await fetchInteractions(accountId, codaToken, codaDocId);
    
    // Transform to canonical Interaction type
    const interactions = codaInteractions.map(ci => 
      codaInteractionToInteraction(ci, accountId)
    );
    
    const response: NotesResponse = {
      interactions,
      total: interactions.length,
      synced: true,
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching interactions:', error);
    
    // Return empty result on error (graceful degradation)
    const response: NotesResponse = {
      interactions: [],
      total: 0,
      synced: false,
    };
    
    res.status(200).json(response);
  }
}

// ============================================================================
// POST Handler - Create Interaction
// ============================================================================

async function handlePost(
  req: VercelRequest,
  res: VercelResponse,
  accountId: string,
  codaToken: string,
  codaDocId: string
): Promise<void> {
  // Parse request body
  const body = req.body as CreateInteractionRequest;
  
  // Validate required fields
  if (!body.summary || typeof body.summary !== 'string') {
    res.status(400).json({ error: 'Summary is required' });
    return;
  }
  
  if (!body.type || !isValidInteractionType(body.type)) {
    res.status(400).json({ 
      error: 'Invalid interaction type',
      validTypes: ['call', 'email', 'meeting', 'note', 'chat', 'qbr', 'onboarding_session', 'training', 'escalation', 'renewal_discussion'],
    });
    return;
  }
  
  // Get creator info from headers or body
  const createdBy = body.createdByName || 
    (req.headers['x-arda-author'] as string) || 
    'Unknown CSM';
  
  // Build CodaInteraction
  const codaInteraction: Omit<CodaInteraction, 'id' | 'rowId'> = {
    tenantId: accountId,
    date: body.occurredAt || new Date().toISOString(),
    type: body.type,
    channel: body.channel,
    subject: body.subject,
    summary: body.summary.trim(),
    sentiment: body.sentiment,
    nextAction: body.nextAction,
    nextActionDate: body.nextActionDate,
    createdBy,
    createdAt: new Date().toISOString(),
  };
  
  try {
    // Create in Coda
    const created = await createInteraction(codaInteraction, codaToken, codaDocId);
    
    if (!created) {
      res.status(500).json({ 
        error: 'Failed to create interaction in Coda',
        synced: false,
      });
      return;
    }
    
    // Transform to canonical type
    const interaction = codaInteractionToInteraction(created, accountId);
    
    const response: CreateNoteResponse = {
      interaction,
      synced: true,
    };
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating interaction:', error);
    res.status(500).json({
      error: 'Failed to create interaction',
      message: error instanceof Error ? error.message : 'Unknown error',
      synced: false,
    });
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

const VALID_INTERACTION_TYPES: InteractionType[] = [
  'call',
  'email',
  'meeting',
  'note',
  'chat',
  'qbr',
  'onboarding_session',
  'training',
  'escalation',
  'renewal_discussion',
];

function isValidInteractionType(type: string): type is InteractionType {
  return VALID_INTERACTION_TYPES.includes(type as InteractionType);
}
