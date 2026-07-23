import { describe, it, expect } from 'vitest';

// Import all door modules
import { PARIS_DOORS } from '../parisDoors.js';
import { MARSEILLE_DOORS } from '../marseilleDoors.js';
import { GENEVA_DOORS } from '../genevaDoors.js';
import { LEMAN_DOORS } from '../lemanDoors.js';
import { LYON_DOORS } from '../lyonDoors.js';
import { BORDEAUX_DOORS } from '../bordeauxDoors.js';
import { STRASBOURG_DOORS } from '../strasbourgDoors.js';

describe('Door ID Uniqueness', () => {
  it('should have no duplicate door IDs across all door modules', () => {
    // Collect all door modules
    const allDoorModules = [
      { name: 'PARIS_DOORS', doors: PARIS_DOORS },
      { name: 'MARSEILLE_DOORS', doors: MARSEILLE_DOORS },
      { name: 'GENEVA_DOORS', doors: GENEVA_DOORS },
      { name: 'LEMAN_DOORS', doors: LEMAN_DOORS },
      { name: 'LYON_DOORS', doors: LYON_DOORS },
      { name: 'BORDEAUX_DOORS', doors: BORDEAUX_DOORS },
      { name: 'STRASBOURG_DOORS', doors: STRASBOURG_DOORS },
    ];

    // Collect all door IDs with their source module
    const doorIdMap = new Map();
    let totalDoorCount = 0;

    for (const { name, doors } of allDoorModules) {
      for (const door of doors) {
        totalDoorCount++;
        if (doorIdMap.has(door.id)) {
          doorIdMap.get(door.id).push(name);
        } else {
          doorIdMap.set(door.id, [name]);
        }
      }
    }

    // Check for duplicates
    const duplicates = Array.from(doorIdMap.entries())
      .filter(([, modules]) => modules.length > 1);

    if (duplicates.length > 0) {
      const duplicateReport = duplicates
        .map(([id, modules]) => `${id}: ${modules.join(', ')}`)
        .join('\n');
      throw new Error(`Duplicate door IDs found:\n${duplicateReport}`);
    }

    // Verify total door count (currently 6 fr-* + 3 fr-* + 3 fr-* + 2 fr-* + 2 fr-* + 2 fr-* + 2 fr-* = 22)
    expect(totalDoorCount).toBeGreaterThan(0);
    expect(doorIdMap.size).toBe(totalDoorCount);
  });

  it('should validate specific French door ID ranges', () => {
    // Validate known door IDs exist
    const expectedIds = new Set([
      // Geneva (fr-13~15)
      'fr-13', 'fr-14', 'fr-15',
      // Leman (fr-16~18)
      'fr-16', 'fr-17', 'fr-18',
      // Lyon (fr-19~20)
      'fr-19', 'fr-20',
      // Bordeaux (fr-21~22)
      'fr-21', 'fr-22',
      // Strasbourg (fr-23~24)
      'fr-23', 'fr-24',
    ]);

    const allDoors = [
      ...PARIS_DOORS,
      ...MARSEILLE_DOORS,
      ...GENEVA_DOORS,
      ...LEMAN_DOORS,
      ...LYON_DOORS,
      ...BORDEAUX_DOORS,
      ...STRASBOURG_DOORS,
    ];

    const foundIds = new Set(allDoors.map(d => d.id));

    for (const expectedId of expectedIds) {
      expect(foundIds.has(expectedId), `Door ID ${expectedId} not found`).toBe(true);
    }
  });
});
