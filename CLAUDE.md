# CLAUDE.md – inthehole
## SA Golf Tracker · A Free Tool by Clean Harry
> Claude Code reads this file automatically at the start of every session.

## Project Identity
- **App name:** inthehole
- **Tagline:** Clean clubs. Sharp grooves. Lower scores.
- **Version:** 1.0.0
- **Owner:** Irvan Damon / WonderLab (Pty) Ltd / Clean Harry
- **Brand parent:** https://cleanharry.world
- **Stack:** Next.js 14 (App Router) · Firebase (Auth + Firestore) · Vercel · Tailwind CSS · PWA
- **Purpose:** Free SA golf scorecard PWA. Brand extension and community asset for Clean Harry.

## Brand Voice
Clean Harry's voice: punchy, British-SA, witty, no-fuss.
- Short sentences. Action-first.
- SA slang welcome: bru, china, lekker, sharp, howzit, sorted
- Never salesy. This is a gift to the SA golf community.
- British spelling throughout.
- The app never pushes a product. Clean Harry is present but subtle.

## Clean Harry Integration (Subtle, Not Pushy)
- Small "Powered by Clean Harry" badge in footer. Links to cleanharry.world
- After results screen: one contextual tip — "Dirty grooves cost you that birdie. One squirt of Clean Harry sorts it. → cleanharry.world". Once per completed round only.
- Splash tagline: "Clean. Score. Perfect." (riff on Clean Harry's "Clean. Aim. Perfect.")
- About page: "inthehole is a free tool from the people behind Clean Harry — SA's first biotech golf club cleaner."

## Architecture Overview
```
inthehole/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── page.tsx                  # Home dashboard
│   │   ├── new-round/page.tsx        # Course select + players
│   │   ├── scorecard/[id]/page.tsx   # Live scoring
│   │   ├── results/[id]/page.tsx     # Results + sharing
│   │   ├── leaderboard/page.tsx
│   │   ├── history/page.tsx
│   │   └── about/page.tsx            # About + Clean Harry
│   ├── api/share/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/
│   ├── brand/
│   │   ├── CleanHarryBadge.tsx       # Footer badge → cleanharry.world
│   │   └── PostRoundTip.tsx          # One-line tip after round complete
│   ├── scorecard/
│   ├── leaderboard/
│   └── courses/
├── lib/
│   ├── firebase/{client,admin,firestore,auth}.ts
│   ├── scoring/engine.ts
│   └── courses/data.ts
├── hooks/{useRound,useLeaderboard,useAuth}.ts
├── types/index.ts
├── public/{manifest.json,sw.js}
├── CLAUDE.md
├── .env.local
└── vercel.json
```

## Firebase Collections

### rounds/{roundId}
```ts
{
  id: string; userId: string; date: Timestamp;
  courseId: string; courseName: string;
  scoringType: 'stableford' | 'stroke';
  holes: number; players: Player[];
  playerResults: PlayerResult[];
  complete: boolean; sharedAt?: Timestamp;
}
```

### leaderboard/{playerId}
```ts
{
  uid: string; displayName: string; photoURL?: string;
  rounds: number; totalPts: number; bestPts: number;
  bestNet: number; handicap: number; updatedAt: Timestamp;
}
```

### users/{uid}
```ts
{
  displayName: string; email: string;
  handicap: number; homeClub?: string; createdAt: Timestamp;
}
```

## Scoring Engine Rules

### Stableford Points
| Net vs Par | Points |
|---|---|
| -3 or better | 5 |
| -2 Eagle | 4 |
| -1 Birdie | 3 |
| 0 Par | 2 |
| +1 Bogey | 1 |
| +2 or worse | 0 |

### Playing Handicap
playingHcp = Math.round(exactHcp * 0.95)

### Strokes on Hole
- playingHcp >= hole.si → 1 stroke
- playingHcp >= hole.si + 18 → 2 strokes

## Colours
```
green-deep:  #0f2d18
green-main:  #1a5c2a
green-light: #2e8b47
green-pale:  #d4edda
gold:        #c9a84c
gold-light:  #f0d080
off-white:   #f8faf8
```

## Environment Variables
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
NEXT_PUBLIC_CLEAN_HARRY_URL=https://cleanharry.world
```

## Key Commands
```bash
npm run dev       # localhost:3000
npm run build     # Production build
vercel --prod     # Deploy
firebase deploy   # Firestore rules + indexes
```

## Conventions
- TypeScript everywhere. No any types.
- Server components by default.
- All Firestore writes through lib/firebase/firestore.ts
- Scoring logic only in lib/scoring/engine.ts
- Clean Harry integration only in components/brand/
- British spelling in all copy.
- Stableford is the default scoring type.
- WhatsApp share is first-class.

## Do Not Touch
- lib/courses/data.ts — Only add courses. Never rename existing IDs.
- lib/scoring/engine.ts — Changes need unit test updates.
- components/brand/PostRoundTip.tsx — One line. One link. Keep it subtle.
