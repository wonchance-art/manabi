/**
 * SM-2 Algorithm Implementation
 * @param {number} quality - User's score from 0 to 5 (0: total blackout, 5: perfect response)
 * @param {Object} prevStats - Previous SRS stats { repetitions, ease_factor, interval }
 * @returns {Object} Updated stats { repetitions, ease_factor, interval, next_review_at }
 */
export function calculateNextReview(quality, { repetitions = 0, ease_factor = 2.5, interval = 0 }) {
  let nextRepetitions;
  let nextEaseFactor;
  let nextInterval;

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      nextInterval = 1;
    } else if (repetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(interval * ease_factor);
    }
    nextRepetitions = repetitions + 1;
  } else {
    // Incorrect response
    nextRepetitions = 0;
    nextInterval = 1;
  }

  // Update Ease Factor
  nextEaseFactor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (nextEaseFactor < 1.3) nextEaseFactor = 1.3;

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

  return {
    repetitions: nextRepetitions,
    ease_factor: nextEaseFactor,
    interval: nextInterval,
    next_review_at: nextReviewAt.toISOString()
  };
}
