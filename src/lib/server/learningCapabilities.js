import { learningLanguageCapabilities, normalizeLearningCapabilities } from '@/lib/learningCapabilities';
import { fail } from '@/lib/server/learningContext';

export async function readLearningCapabilities(client) {
  try {
    const { data, error } = await client.rpc('learning_language_capabilities');
    return normalizeLearningCapabilities(error ? null : data);
  } catch {
    return normalizeLearningCapabilities(null);
  }
}

export async function requireLearningCapability(client, language, action = 'save') {
  if (language !== 'Korean') return;
  const contract = await readLearningCapabilities(client);
  if (!learningLanguageCapabilities(language, contract)[action]) {
    fail(503, '한국어 단어 저장·복습을 아직 사용할 수 없어요. 잠시 후 다시 확인해 주세요.', {
      extra: { code: 'learning_storage_unavailable' },
    });
  }
}
