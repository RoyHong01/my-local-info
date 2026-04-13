# Security Policy / 보안 정책

## Supported Versions / 지원 버전

현재 이 저장소는 별도 장기지원(LTS) 릴리스 없이 `main` 브랜치 기준으로 유지보수합니다.

| Branch / Version | Supported | Notes |
| --- | --- | --- |
| `main` (latest) | ✅ | Security fixes are applied here first. |
| Older commits / non-default branches | ❌ | No guaranteed security backports. |

## Reporting a Vulnerability / 취약점 제보 방법

보안 취약점은 **공개 Issue에 등록하지 마세요.**  
Please **do not** report security vulnerabilities via public Issues.

### Preferred channel / 권장 채널

GitHub Private Vulnerability Reporting (Security Advisory)로 제보해 주세요.

1. Go to: **Security** tab in this repository  
2. Click: **Advisories**  
3. Click: **Report a vulnerability**

### What to include / 제보 시 포함 정보

가능하면 아래 정보를 함께 주세요.

- 취약점 요약 및 예상 영향 범위
- 재현 절차 (step-by-step)
- PoC 또는 관련 스크린샷/로그 (가능한 경우)
- 영향받는 파일/경로/기능
- 제보자 연락 가능한 방법

### Response timeline / 응답 기준

- **72시간 이내** 1차 접수 확인 (Acknowledgement)
- **7영업일 이내** 재현/영향도 초기 평가 공유
- 수정 가능 시 패치 일정 안내 및 배포 전후 상태 업데이트 제공

복잡도, 의존성 이슈, 외부 서비스 영향에 따라 일정은 조정될 수 있습니다.

### Disclosure policy / 공개 정책

- 검증된 취약점은 패치/완화 조치 준비 후 공개를 원칙으로 합니다.
- 공개 시점은 사용자 보호와 악용 가능성을 함께 고려해 결정합니다.
- 제보자는 정책 범위 내에서 크레딧(희망 시) 표기할 수 있습니다.

## Scope / 범위

In scope (예시):

- 원격 코드 실행, 권한 상승, 인증 우회
- 민감정보 노출, 임의 파일 접근
- 서비스 거부(DoS) 유발 가능 취약점

Out of scope (예시):

- 사회공학(피싱), 물리적 접근 필요 이슈
- 이미 공개된 제3자 라이브러리 이슈만 단순 제시한 경우
- 재현 불가 또는 영향이 없는 오탐 제보

## Safe Harbor / 선의의 연구자 보호

본 정책을 준수하고, 서비스 안정성을 해치지 않는 선의의 보안 연구 활동에 대해서는 법적 대응보다 신속한 수정 협력을 우선합니다.
