import { NextRequest, NextResponse } from 'next/server'

// Fault-to-mantra lookup table
const FAULT_MANTRAS: Record<string, string> = {
  thin: 'WEIGHT STAYS FORWARD',
  topped: 'WEIGHT STAYS FORWARD',
  slice: 'RELEASE THE CLUBHEAD',
  fade: 'RELEASE THE CLUBHEAD',
  hook: 'HOLD THE FACE',
  draw: 'HOLD THE FACE',
  push: 'TURN THROUGH IT',
  pull: 'COMMIT AND SWING',
  fat: 'BALL THEN TURF',
  heel: 'BALL THEN TURF',
  toe: 'STAY IN POSTURE',
}

function getFaultMantra(miss: string, contact: string): string | null {
  const combined = `${miss} ${contact}`.toLowerCase()
  for (const [fault, mantra] of Object.entries(FAULT_MANTRAS)) {
    if (combined.includes(fault)) return mantra
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { swingAnalysis, clubBreakdown } = await req.json()

    const mostCommonMiss = swingAnalysis?.mostCommonMiss || ''
    const mostCommonContact = swingAnalysis?.mostCommonBadContact || ''

    // 1. Try lookup table first (fast, no API call)
    const lookupMantra = getFaultMantra(mostCommonMiss, mostCommonContact)
    if (lookupMantra) {
      return NextResponse.json({ mantra: lookupMantra })
    }

    // 2. If player has swing data but no table match, ask Claude
    if (mostCommonMiss || mostCommonContact) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 20,
          system: `You are a golf coach. Generate a 3-word swing mantra.
Return ONLY the 3 words in UPPERCASE. No punctuation. No explanation. No quotes.
Example outputs: WEIGHT STAYS FORWARD | RELEASE THE CLUBHEAD | BALL THEN TURF`,
          messages: [
            {
              role: 'user',
              content: `Player's most common miss: ${mostCommonMiss || 'unknown'}. Most common bad contact: ${mostCommonContact || 'unknown'}. Give me the 3-word mantra.`,
            },
          ],
        }),
      })

      const data = await response.json()
      const text = data.content?.[0]?.text?.trim().toUpperCase()

      // Validate: exactly 3 words, all caps
      if (text && text.split(' ').length === 3) {
        return NextResponse.json({ mantra: text })
      }
    }

    // 3. Fallback
    return NextResponse.json({ mantra: 'BREATHE AIM COMMIT' })
  } catch (error) {
    console.error('Mantra generation error:', error)
    return NextResponse.json({ mantra: 'BREATHE AIM COMMIT' })
  }
}
