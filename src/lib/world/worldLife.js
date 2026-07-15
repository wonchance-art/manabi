const hashText = (text) => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export function cityWeatherAt(cityId, snapshot) {
  const block = Math.floor((snapshot?.minuteOfDay || 0) / 240);
  const value = hashText(`${cityId}:${snapshot?.day || 0}:${block}`) % 100;
  const coastal = ['fukuoka', 'tokyo', 'osaka'].includes(cityId);
  if (value < (coastal ? 16 : 11)) return { id: 'rain', label: '비', icon: '☂', visibility: 0.82 };
  if (value < 22) return { id: 'fog', label: '옅은 안개', icon: '≋', visibility: 0.72 };
  if (value < 58) return { id: 'cloudy', label: '흐림', icon: '☁', visibility: 0.9 };
  return { id: 'clear', label: '맑음', icon: '☀', visibility: 1 };
}

export function isOpenAt(hours, minuteOfDay) {
  if (!hours) return true;
  if (hours === 'always') return true;
  const windows = Array.isArray(hours[0]) ? hours : [hours];
  return windows.some(([start, end]) => {
    if (start === end) return true;
    return start < end
      ? minuteOfDay >= start && minuteOfDay < end
      : minuteOfDay >= start || minuteOfDay < end;
  });
}

export function defaultHoursForNode(node) {
  if (node?.npc === 'konbini' || /空港|駅|港/.test(node?.name || '')) return 'always';
  if (node?.npc === 'izakaya') return [17 * 60, 2 * 60];
  if (node?.npc === 'ramen' || /ラーメン|一風堂/.test(node?.name || '')) {
    return [[11 * 60, 15 * 60], [17 * 60, 23 * 60]];
  }
  if (node?.kind === 'shop') return [10 * 60, 21 * 60];
  return 'always';
}

export function nodeLifeAt(node, snapshot) {
  const open = isOpenAt(node?.hours || defaultHoursForNode(node), snapshot?.minuteOfDay || 0);
  return { open, label: open ? '영업 중' : '영업 종료' };
}

const EVENTS = {
  fukuoka: ['하카타항 아침 하역', '텐진 거리 산책', '나카스 야간 포장마차'],
  tokyo: ['시나가와 출근 물결', '시부야 교차 인파', '도쿄만 야경 시간'],
  osaka: ['오사카성 아침 산책', '도톤보리 인파', '환상선 야간 운행'],
  kyoto: ['신사 아침 참배', '기온 거리 등불', '교토역 귀가 물결'],
};

export function worldEventAt(cityId, snapshot) {
  const minute = snapshot?.minuteOfDay || 0;
  const index = minute < 600 ? 0 : minute < 1200 ? 1 : 2;
  const names = EVENTS[cityId] || ['도시의 아침', '도시의 저녁', '도시의 밤'];
  return { id: `${cityId}:${snapshot?.day || 0}:${index}`, label: names[index], active: true };
}
