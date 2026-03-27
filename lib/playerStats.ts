import { doc, setDoc, getDocs, collection, increment } from 'firebase/firestore';
import { db } from './firebase';

export interface PlayerStats {
  name: string;
  wins: number;
}

export async function recordWin(playerId: string, playerName: string): Promise<void> {
  await setDoc(
    doc(db, 'playerStats', playerId),
    { name: playerName, wins: increment(1) },
    { merge: true },
  );
}

export async function fetchAllStats(): Promise<Record<string, PlayerStats>> {
  const snap = await getDocs(collection(db, 'playerStats'));
  const result: Record<string, PlayerStats> = {};
  snap.forEach(d => {
    result[d.id] = d.data() as PlayerStats;
  });
  return result;
}
