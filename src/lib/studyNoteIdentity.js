// Keep general library/viewer routes independent of the canvas implementation.
export const isStudyNote = material => material?.processed_json?.metadata?.studyNote?.version === 1;
