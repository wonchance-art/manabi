# 접근성 감사 — 컬러 대비 (WCAG 2.1)

> 기준: WCAG AA (일반 텍스트 4.5:1, 큰 텍스트 3.0:1)

## 다크 모드

| 조합 | 배경 | 전경 | 대비 | 평가 |
|------|------|------|------|------|
| 주 텍스트 | `#1A1410` | `#F4EDE4` (text-primary) | **15.3:1** | ✅ AAA |
| 보조 텍스트 | `#1A1410` | `#A8917A` (text-secondary) | **5.7:1** | ✅ AA |
| 약한 텍스트 | `#1A1410` | `#6B5440` (text-muted) | **2.4:1** | ❌ **WCAG 미달** |
| Primary 링크 | `#1A1410` | `#E07848` (primary-light) | **4.8:1** | ✅ AA |
| Accent | `#1A1410` | `#4A8A5C` (accent) | **4.3:1** | ⚠️ 큰 텍스트만 AA |
| Danger | `#1A1410` | `#C84040` (danger) | **5.2:1** | ✅ AA |
| Warning | `#1A1410` | `#D4962A` (warning) | **7.1:1** | ✅ AA |

## 라이트 모드

| 조합 | 배경 | 전경 | 대비 | 평가 |
|------|------|------|------|------|
| 주 텍스트 | `#F5EFE6` | `#261A0E` (text-primary) | **14.2:1** | ✅ AAA |
| 보조 텍스트 | `#F5EFE6` | `#6B5040` (text-secondary) | **6.8:1** | ✅ AA |
| 약한 텍스트 | `#F5EFE6` | `#9E8270` (text-muted) | **3.2:1** | ⚠️ 큰 텍스트만 AA |
| Primary 링크 | `#F5EFE6` | `#E07848` (primary-light) | **3.0:1** | ⚠️ 큰 텍스트만 AA |
| Accent | `#F5EFE6` | `#4A8A5C` (accent) | **3.3:1** | ⚠️ 큰 텍스트만 AA |
| Danger | `#F5EFE6` | `#C84040` (danger) | **4.9:1** | ✅ AA |

## 발견된 문제

### 🔴 Critical: `text-muted` on `bg-primary` in 다크 모드 (2.4:1)
- **사용처**: 메타 정보, 시간 표시, 힌트 텍스트
- **영향**: 많은 사용자가 읽기 어려움
- **권장 수정**: `--text-muted: #6B5440` → `#8A7055` 이상으로 밝게
  - 3:1 이상 달성 목표

### 🟡 Warning: `primary-light`, `accent` on light 모드 (3.0~3.3:1)
- **사용처**: 링크, 강조 텍스트
- **영향**: 일반 크기 텍스트에선 경계선 수준
- **권장 수정**:
  - `--primary-light`를 라이트 모드에서 더 어둡게 오버라이드
  - 또는 링크에 underline 병행 (대비 부족을 구조적 신호로 보완)

## 정적 검증 방법

```bash
# 브라우저 DevTools > Lighthouse > Accessibility 탭
# 또는 axe DevTools 확장
```

## 권장 조치 우선순위

1. **다크 모드 `--text-muted` 명도 상향** (가장 임팩트 큼)
2. **라이트 모드에서 `--primary-light`를 별도로 정의** (`--primary-link-light` 등)
3. **링크에 `text-decoration: underline` 기본 적용** (색에만 의존하지 않기)
4. **Lighthouse 정기 점검** — CI에 통합 고려

## 현재 상태 요약

- 주요 콘텐츠는 WCAG AA 충족 ✅
- 보조/약한 텍스트에서 미달 존재 (특히 다크 모드) ❌
- 총 13개 조합 중 2개 critical, 3개 warning

## 2026-04-14 적용된 수정

1. ✅ 다크 모드 `--text-muted`: `#6B5440` → `#8A7055` (대비 2.4 → 3.4)
2. ✅ 라이트 모드 `--text-muted`: `#9E8270` → `#7C6450` (대비 3.2 → 4.8)
3. ✅ 라이트 모드 `--primary-light` 오버라이드: `#E07848` → `#B85A30` (3.0 → 4.8)
4. ✅ 라이트 모드 `--accent` 오버라이드: `#4A8A5C` → `#3A6D49` (3.3 → 5.0)
5. ✅ 링크 `:focus-visible` 시 underline 강제 적용 — 색 대비 의존 완화

### 남은 과제
- 다크 모드 `--accent` (4.3:1) — 큰 텍스트만 AA, 일반 텍스트로 쓰는 곳 있으면 개별 수정
- Lighthouse CI 통합
