/**
 * FSRS v4 Algorithm Implementation
 * Based on Open Spaced Repetition (fsrs4anki)
 */

const DEFAULT_WEIGHTS = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
];

/**
 * @param {number} rating - Again (1), Hard (2), Good (3), Easy (4)
 * @param {Object} prevStats - { interval (stability), ease_factor (difficulty), repetitions (lapses), next_review_at }
 * @returns {Object} Updated stats
 */
export function calculateFSRS(rating, { interval: S = 0, ease_factor: D = 0, repetitions: lapses = 0 }) {
  const w = DEFAULT_WEIGHTS;
  
  // Initial states if never reviewed
  if (S === 0) {
    const newS = w[rating - 1];
    const newD = w[4] - (rating - 3) * w[5];
    return finalize(newS, newD, lapses);
  }

  // Calculate Retrievability (Time since last review / Current Stability)
  // For simplicity, we assume R is around 0.9 when scheduled correctly.
  // In a real system, we'd calculate: t = (now - last_review) / (24 * 3600 * 1000)
  // Here we approximate based on the current interval.
  const t = S; 
  const R = Math.pow(0.9, t / S);

  // Update Difficulty
  let deltaD = -(w[6] * (rating - 3));
  let newD = D + deltaD;
  newD = Math.max(1, Math.min(10, newD));

  // Update Stability
  let newS;
  if (rating === 1) {
    // Again (Fail)
    newS = w[11] * Math.pow(newD, -w[12]) * (Math.pow(S + 1, w[13]) - 1) * Math.exp(w[14] * (1 - R));
    lapses += 1;
  } else {
    // Hard, Good, Easy (Success)
    const hardPenalty = (rating === 2) ? w[15] : 1;
    const easyBonus = (rating === 4) ? w[16] : 1;
    newS = S * (1 + Math.exp(w[8]) * (11 - newD) * Math.pow(S, -w[9]) * (Math.exp(w[10] * (1 - R)) - 1) * hardPenalty * easyBonus);
  }

  return finalize(newS, newD, lapses);
}

function finalize(S, D, lapses) {
  const nextReviewAt = new Date();
  const interval = Math.max(1, Math.round(S));
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  return {
    interval: S,        // Stability
    ease_factor: D,     // Difficulty
    repetitions: lapses, // Lapses
    next_review_at: nextReviewAt.toISOString()
  };
}
