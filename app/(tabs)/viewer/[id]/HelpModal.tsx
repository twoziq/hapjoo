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
            하단 ▶ 버튼 또는 접힌 헤더의 ▶로 재생. 카운트인(주황 점) 후 시작. 재생 중 마디를 탭하면 해당 위치로 이동.
          </HelpRow>
          <HelpRow icon="🥁" title="메트로놈 박자 표시">
            재생 시 상단에 동그라미 박자 표시. 카운트인은 주황색, 재생 중은 빨간색.
          </HelpRow>
          <HelpRow icon="♩" title="박자표 꾹 누르기">
            4/4 · 3/4 · 6/8 중 선택.
          </HelpRow>
          <HelpRow icon="↯" title="BPM 꾹 누르기">
            BPM 숫자를 길게 누르면 직접 입력. +/− 버튼으로 1씩 조절.
          </HelpRow>
          <HelpRow icon="남/여" title="키 전환">
            남/여 버튼으로 키 전환. 곡에 성별이 지정된 경우 기본으로 해당 키가 설정됨.
          </HelpRow>
          <HelpRow icon="⭐" title="저장소에 저장">
            로그인 후 ⭐ 버튼으로 내 저장소 컬렉션에 추가. 저장소 상세 화면에서도 곡을 직접 추가할 수 있어요.
          </HelpRow>
          <HelpRow icon="♪" title="합주 모드">
            ♪ 버튼을 켜면 합주 모드. 재생·정지 신호가 같은 곡을 보는 모든 기기에 실시간으로 공유돼요. 가장 마지막에 누른 사람의 조작이 적용됩니다.
          </HelpRow>
          <HelpRow icon="▴" title="헤더 접기 / 펼치기">
            접기를 누르면 현재 재생 중인 구간 이름(Verse, Chorus 등)만 표시되고, 펼치기·재생 버튼만 남아요. 악보를 더 넓게 볼 수 있어요.
          </HelpRow>
          <HelpRow icon="↕" title="자동 스크롤">
            재생 중 구간이 바뀌면 새 구간이 자동으로 화면 맨 위로 스크롤돼요.
          </HelpRow>
          <HelpRow icon="💬" title="마디 꾹 누르기">
            마디를 길게 누르면 메모 입력 가능. 저장하면 말풍선(▾)으로 표시됩니다.
          </HelpRow>
          <HelpRow icon="수정" title="악보 편집">
            수정 버튼을 누르면 편집 화면으로 이동. 제목·BPM·키·구간·줄·코드·가사 모두 수정 가능. 저장하면 뷰어로 돌아옵니다.
          </HelpRow>
          <HelpRow icon="🎵" title="코드 표기법">
            {'Bb, F#, Gm, Cmaj7, G7, Am7, Gm7b5, Bb/D 등 일반적인 코드를 지원해요.\n플랫(b)/샵(#) 수식: b5, b7, b9, #5, #7, #9 등.\n한 마디에 코드 여러 개: [G.D.Em.Am] 형식으로 점(.)으로 구분.'}
          </HelpRow>
        </div>
      </div>
    </div>
  );
}
