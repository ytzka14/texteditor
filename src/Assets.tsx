// Assets.ts (또는 타입 정의 파일)
import { nanoid } from "nanoid"; // npm 패키지로 nanoid 사용 가정

// 각 블록을 식별할 고유 id와 텍스트를 저장하는 인터페이스
export type Block = {
  id: string;   // 고유 키
  html: string; // 블록 안의 실제 문자열
}

export type Section = {
  id: string;
  name: string;
  content: Block[];
  subsections: Section[];
}


export const text: Section[] = [
  {
    id: nanoid(),
    name: "Natural Language Processing",
    content: [
      {id: nanoid(), html: "자연어 처리 분야는 /vaswani2017attention/의 트랜스포머 아키텍처 도입으로 혁신적인 발전을 이루었다."}
    ],
    subsections: [
      {
        id: nanoid(),
        name: "BERT-based Models",
        content: [
          {id: nanoid(), html: "/devlin2018bert/는 양방향 트랜스포머 사전 훈련을 통해 언어 이해 성능을 크게 향상시켰으며, 다양한 NLP 태스크에서 새로운 기준을 설정했다."}
        ],
        subsections: []
      },
      {
        id: nanoid(),
        name: "Generative Language Models",
        content: [
          {id: nanoid(), html: "/brown2020gpt3/는 1750억 개의 매개변수를 가진 대규모 언어 모델로, few-shot learning을 통해 다양한 태스크를 수행할 수 있는 가능성을 보여주었다."}
        ],
        subsections: []
      }
    ]
  },
  {
    id: nanoid(),
    name: "Computer Vision",
    content: [
      {id: nanoid(), html: "컴퓨터 비전 분야는 깊은 신경망의 발전과 함께 크게 발전했다."}
    ],
    subsections: [
      {
        id: nanoid(),
        name: "CNN Architectures",
        content: [
          {id: nanoid(), html: "/simonyan2014vgg/는 매우 깊은 컨볼루션 네트워크의 효과를 입증하였으며, 작은 3x3 필터를 사용하여 네트워크의 깊이를 증가시키는 방법을 제안했다."},
          {id: nanoid(), html: "/he2016resnet/는 잔차 연결(residual connection)을 도입하여 매우 깊은 네트워크의 훈련을 가능하게 하였으며, degradation 문제를 해결하는 혁신적인 접근법을 제시했다."}
        ],
        subsections: []
      }
    ]
  }
]

export const papers = [
  "brown2020gpt3",
  "vaswani2017attention",
  "devlin2018bert",
  "simonyan2014vgg",
  "he2016resnet"
]

// Assets.ts나 별도 유틸 파일에 두셔도 OK
export function parseRawToHtml(raw: string): string {
  // itemsList는 기존에 쓰던 논문 제목 배열 등, 
  // 실제 가능한 토큰 목록(p1, p2, ...)을 포함한다고 가정
  const itemsList = papers; // 또는 상단에 import { papers } from "./Assets";

  // 정규식: /(토큰이름)/ 패턴을 찾아서, itemsList에 있으면 <span>으로 변환
  return raw.replace(/\/(.*?)\//g, (_, key: string) => {
    if (itemsList.includes(key)) {
      // contenteditable="false" 로 고정 토큰으로 표시
      return `<span class="inline-item" contenteditable="false">${key}</span>`;
    }
    // 목록에 없으면 원래 텍스트(/abc/) 그대로 출력
    return `/${key}/`;
  });
}

export function recursiveParseRawToHtml(sections: Section[]): Section[] {
  return sections.map((sec) => ({
    ...sec,
    content: sec.content.map((blk) => ({
      ...blk,
      html: parseRawToHtml(blk.html), // 각 블록의 HTML 변환
    })),
    subsections: recursiveParseRawToHtml(sec.subsections), // 하위 섹션도 재귀적으로 처리
  }));
}
