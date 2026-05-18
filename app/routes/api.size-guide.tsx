import type {Route} from './+types/api.size-guide';
import Anthropic from '@anthropic-ai/sdk';

const SIZING_PROMPT = `Tu es un expert du sizing pour les marques de mode françaises et internationales.

À propos de Jacquemus :
- Jacquemus taille petit : généralement 1 taille en-dessous par rapport aux marques standard françaises/européennes
- Les pièces structurées (robes ajustées, bodysuits, pantalons) taillent le plus petit
- Les pièces fluides et oversized taillent plus normalement

Correspondances par marque :
- Taillent PETIT comme Jacquemus → garder la même taille Jacquemus :
  Sandro, Maje, AMI Paris, A.P.C., Rouje (pour leurs pièces ajustées)
- Taillent NORMALEMENT → prendre 1 taille au-dessus chez Jacquemus :
  Isabel Marant, Arket, COS, & Other Stories, Toteme, Uniqlo, Rouje (fluide)
- Taillent GRAND → garder la même taille chez Jacquemus (ou 1 en-dessous) :
  Zara, H&M, Mango, Bershka, ASOS

Tailles Jacquemus : 34 (XS), 36 (S), 38 (M), 40 (L), 42 (XL), 44 (XXL)

Retourne UNIQUEMENT du JSON valide :
{"jacquemusSize": "38", "note": "1 phrase courte et rassurante en français."}
La note doit mentionner la marque de référence. Maximum 15 mots.`;

export async function action({request, context}: Route.ActionArgs) {
  let brand: string;
  let size: string;
  try {
    ({brand, size} = (await request.json()) as {brand: string; size: string});
  } catch {
    return Response.json({error: 'Invalid JSON body'}, {status: 400});
  }

  if (!brand || !size) {
    return Response.json({error: 'brand and size are required'}, {status: 400});
  }

  const env = context.env as unknown as Record<string, string | undefined>;
  const anthropicKey = env.ANTHROPIC_API_KEY ?? '';

  if (!anthropicKey || anthropicKey.startsWith('sk-ant-REPLACE')) {
    return Response.json({error: 'ANTHROPIC_API_KEY not configured'}, {status: 500});
  }

  const client = new Anthropic({apiKey: anthropicKey});

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 120,
    system: SIZING_PROMPT,
    messages: [
      {role: 'user', content: `Marque habituelle : ${brand}, Taille habituelle : ${size}`},
    ],
  });

  const rawJson =
    msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '{}';

  let parsed: {jacquemusSize?: string; note?: string} = {};
  try {
    parsed = JSON.parse(rawJson.replace(/```(?:json)?\n?|\n?```/g, '').trim()) as typeof parsed;
  } catch {
    parsed = {};
  }

  return Response.json({
    jacquemusSize: parsed.jacquemusSize ?? size,
    note: parsed.note ?? '',
  });
}
