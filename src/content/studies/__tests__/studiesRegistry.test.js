import { describe, expect, it } from 'vitest';
import {
  STUDY_COUNTRIES, STUDY_DOMAINS, getStudyCountry, getStudyDoc, studyDomainLabel,
} from '../index.js';

// 지역학 레지스트리 계약 — 문서 스키마(제목·섹션·출처·검증 노트)와 슬러그 무결성을 고정한다.
// 오너 1기 수위 정책: 수치 연도 병기·헤지, 정치 평가 배제 — verification 필드 존재를 강제해
// 검증 노트 없는 문서가 실리는 것을 차단한다.

describe('지역학 레지스트리 계약', () => {
  it('나라·도메인 레지스트리 무결성', () => {
    expect(STUDY_COUNTRIES.length).toBeGreaterThan(0);
    expect(new Set(STUDY_COUNTRIES.map((c) => c.id)).size).toBe(STUDY_COUNTRIES.length);
    const domainIds = new Set(STUDY_DOMAINS.map((d) => d.id));
    for (const country of STUDY_COUNTRIES) {
      expect(country.nameKo?.length).toBeGreaterThan(0);
      expect(country.intro?.length).toBeGreaterThan(0);
      for (const doc of country.docs) {
        expect(domainIds.has(doc.domain), `${doc.slug} → ${doc.domain}`).toBe(true);
      }
    }
  });

  it('문서 슬러그는 나라 안에서 유일하고 나라 접두를 가진다', () => {
    const prefixes = { japan: 'jp-' };
    for (const country of STUDY_COUNTRIES) {
      const slugs = country.docs.map((doc) => doc.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      const prefix = prefixes[country.id];
      if (prefix) for (const slug of slugs) expect(slug.startsWith(prefix), slug).toBe(true);
    }
  });

  it('문서 스키마 — 제목·요약·갱신일·섹션(문단)·출처·검증 노트 필수', () => {
    for (const country of STUDY_COUNTRIES) {
      for (const doc of country.docs) {
        expect(doc.title?.length).toBeGreaterThan(0);
        expect(doc.summary?.length).toBeGreaterThan(0);
        expect(doc.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(doc.sections.length).toBeGreaterThanOrEqual(3);
        for (const section of doc.sections) {
          expect(section.heading?.length).toBeGreaterThan(0);
          expect(section.paras.length).toBeGreaterThan(0);
          if (section.table) {
            expect(section.table.head.length).toBeGreaterThan(0);
            for (const row of section.table.rows) expect(row.length).toBe(section.table.head.length);
          }
        }
        expect(doc.sources.length).toBeGreaterThan(0);
        for (const source of doc.sources) {
          expect(source.label?.length).toBeGreaterThan(0);
          expect(source.scope?.length).toBeGreaterThan(0);
        }
        expect(doc.verification?.length).toBeGreaterThan(0);
      }
    }
  });

  it('조회 API — 존재/부재', () => {
    expect(getStudyCountry('japan')?.nameKo).toBe('일본학');
    expect(getStudyCountry('nowhere')).toBeNull();
    expect(getStudyDoc('japan', 'jp-overview')?.domain).toBe('overview');
    expect(getStudyDoc('japan', 'jp-none')).toBeNull();
    expect(studyDomainLabel('overview')).toBe('개관');
  });
});
