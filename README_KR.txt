YOYOJIN · ULSAN 2026 AR / 3개 테스트

[매핑]
0 -> 1.jpg 인식 -> 1.jpeg 표시
1 -> 2.jpg 인식 -> 2.jpeg 표시
2 -> 3.png 인식 -> 3.jpeg 표시

[중요]
사용자가 올린 1.mind 파일을 검사한 결과 타깃이 1개(dataList 길이 1)뿐입니다.
따라서 3개 인식에는 사용할 수 없습니다. 이름만 targets.mind로 바꾸면 안 됩니다.

[GitHub에 먼저 올릴 파일]
index.html
targets.json
make_targets.html
1.jpg / 1.jpeg
2.jpg / 2.jpeg
3.png / 3.jpeg

[targets.mind 만드는 방법]
1. 위 파일들을 GitHub Pages 저장소 루트에 올립니다.
2. https://YOUR_ID.github.io/YOUR_REPO/make_targets.html 접속
3. 화면에 targetIndex 0,1,2와 이미지 3개가 모두 확인되는지 봅니다.
4. 'targets.mind 생성' 클릭
5. 다운로드된 targets.mind를 저장소 루트(index.html 옆)에 업로드
6. GitHub Pages가 반영된 뒤 index.html을 엽니다.
7. '카메라 시작' -> 카메라 권한 허용 -> 벽화 캐릭터를 비춥니다.

[파일 이름]
GitHub Pages는 대소문자를 구분할 수 있으니 아래 이름 그대로 사용하세요.
1.jpg, 1.jpeg, 2.jpg, 2.jpeg, 3.png, 3.jpeg, targets.json, targets.mind

[600개 확장]
600개 자연 이미지 타깃을 targets.mind 하나에 넣는 것은 권장하지 않습니다.
현재 1개 타깃 mind가 약 120KB이므로 단순 선형 가정만 해도 600개면 수십 MB가 될 수 있고,
모바일에서 초기 로딩/메모리/매칭 속도와 유사한 흑백 캐릭터 간 오인식이 문제가 될 수 있습니다.
전시 운영은 30~60개 단위 구역별 mind 파일 또는 각 작품의 고유 QR/마커를 권장합니다.
