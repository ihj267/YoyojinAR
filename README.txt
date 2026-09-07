YOYOJIN ULSAN 2026 AR - 3개 실파일 기준 테스트 패키지

[이 패키지에서 실제 매핑]
타깃 1: 1.jpg  -> 화면 표시: 1.jpeg
타깃 2: 2.jpg  -> 화면 표시: 2.jpeg
타깃 3: 3.png  -> 화면 표시: 3.jpeg

중요: 기존 targets.json의 1.JPG -> 1.PNG 구조와 실제 파일명이 달랐습니다.
GitHub Pages는 파일명 대소문자와 확장자를 정확히 구분하므로 targets.json을 이 패키지의 것으로 교체해야 합니다.

[반드시 새 targets.mind 만들기]
현재 3개 인식용 작은 캐릭터 이미지를 다음 순서로 MindAR Compiler에 넣으세요.
1) 1.jpg
2) 2.jpg
3) 3.png

다운로드된 .mind 파일 이름을 targets.mind 로 바꾸고 index.html 옆에 놓으세요.
공식 컴파일러: https://hiukim.github.io/mind-ar-js-doc/tools/compile/

[GitHub 루트 구조]
index.html
targets.json
targets.mind
1.jpg
1.jpeg
2.jpg
2.jpeg
3.png
3.jpeg

[사용 방식]
- 카메라 시작
- 벽화 속 작은 캐릭터 이미지가 인식되면 연결된 전체 원본 그림이 아래 뷰어에 열림
- 원본 그림이 기본 화면
- 탭 또는 좌우 스와이프로 '원본 그림 / 벽화 캐릭터' 전환
- 두 손가락 핀치 줌
- 확대 후 한 손가락 드래그
- 더블 탭 또는 '크기 초기화'로 초기화
- 오른쪽 위 ↗ 버튼으로 거의 전체화면 확대
- 뷰어가 열린 상태에서도 카메라는 계속 인식하므로 다른 타깃을 비추면 자동으로 교체

[600개 확장]
- targets.json에 항목을 계속 추가
- marker/artwork 파일은 인식된 작품 2장만 그때 로드하므로 이미지 600개가 한꺼번에 다운로드되지는 않음
- targets.mind는 600개 타깃을 포함하므로 모바일 인식 성능은 반드시 실제 기기에서 단계적으로 테스트 권장
- maxTrack은 1로 유지

[간편 컴파일]
make_targets.html도 같이 넣었습니다.
GitHub Pages에서 /make_targets.html을 열고 'targets.mind 생성'을 누르면 현재 3개 타깃(1.jpg, 2.jpg, 3.png)을 순서대로 컴파일하도록 작성했습니다.
다운로드된 targets.mind를 다시 저장소 루트에 업로드하세요.
