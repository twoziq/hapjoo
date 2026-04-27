'use client';

import type { ReactNode } from 'react';

interface Props {
  onClose: () => void;
}

interface RowProps {
  icon: string;
  title: string;
  children: ReactNode;
}

function HelpRow({ icon, title, children }: RowProps) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-lg shrink-0 w-6 text-center leading-snug">{icon}</span>
      <div>
        <p className="font-semibold text-gray-800 text-xs">{title}</p>
        <p className="text-gray-500 text-[11px] mt-0.5 whitespace-pre-line leading-relaxed">
          {children}
        </p>
      </div>
    </div>
  );
}

export default function HelpModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">도움말</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-400 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <HelpRow icon="▶" title="재생 / 정지">
            마디 클릭 → 해당 위치부터 바로 재생. ▶ 버튼은 카운트인 후 시작.
          </HelpRow>
          <HelpRow icon="🥁" title="메트로놈">
            재생 시 상단에 박자 동글뱅이 표시. 카운트인은 주황색, 재생 중은 빨간색. 박자에 맞춰 마디
            커서도 이동.
          </HelpRow>
          <HelpRow icon="♩" title="박자표 꾹 누르기">
            4/4 · 3/4 · 6/8 중 선택.
          </HelpRow>
          <HelpRow icon="↯" title="BPM 꾹 누르기">
            BPM 숫자를 길게 누르면 직접 입력. +/- 버튼으로 1씩 조절.
          </HelpRow>
          <HelpRow icon="남/여" title="키 전환">
            남/여 버튼으로 키 전환. 곡에 성별이 지정된 경우 해당 키로 설정됨.
          </HelpRow>
          <HelpRow icon="접기" title="헤더 접기">
            접기/펼치기 버튼으로 상단 컨트롤 토글.
          </HelpRow>
          <HelpRow icon="💬" title="마디 꾹 누르기">
            메모 입력 → 말풍선으로 표시.
          </HelpRow>
          <HelpRow icon="✎" title="악보 편집">
            ✎ 버튼을 누르면 악보 편집 화면으로 이동. 제목·BPM·키·구간·줄·코드·가사 모두 수정 가능.
            저장하면 뷰어로 돌아옴.
          </HelpRow>
        </div>
      </div>
    </div>
  );
}
