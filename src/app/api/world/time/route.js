import { NextResponse } from 'next/server';
import {
  WORLD_EPOCH_GAME_MINUTE,
  WORLD_EPOCH_REAL_MS,
  WORLD_TIME_SCALE,
  worldTimeAt,
} from '../../../../lib/world/worldClock';

export const dynamic = 'force-dynamic';

export function GET() {
  const serverNowMs = Date.now();
  return NextResponse.json({
    serverNowMs,
    epochRealMs: WORLD_EPOCH_REAL_MS,
    epochGameMinute: WORLD_EPOCH_GAME_MINUTE,
    scale: WORLD_TIME_SCALE,
    world: worldTimeAt(serverNowMs),
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
