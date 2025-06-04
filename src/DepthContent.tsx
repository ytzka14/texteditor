// DepthContent.tsx

import type { Section } from "./Assets";
import { useRef } from "react";

type DepthContentProps = {
  content: string;
  depth: number;
  section: Section;
  fullContent: Section[];
  setFullContent: (sections: Section[]) => void;
}

const DepthContent = (props: DepthContentProps) => {
  const titleRef = useRef<HTMLHeadingElement>(null);

  /**
   * 섹션 제목을 편집할 때 호출됩니다.
   * - targetId: 편집된 섹션의 고유 ID (string)
   * - newName: 새롭게 변경된 제목 문자열
   */
  const handleTitleEdit = (newName: string | undefined) => {
    if (newName === undefined) return;

    const updateSectionName = (
      sections: Section[],
      targetId: string,
      newName: string
    ): Section[] => {
      return sections.map((sec) => {
        if (sec.id === targetId) {
          // ID가 일치하면 이름만 교체
          return { ...sec, name: newName };
        }
        // 자식 subsections가 있다면 재귀적으로 탐색
        return {
          ...sec,
          subsections: updateSectionName(sec.subsections, targetId, newName),
        };
      });
    };

    const newSections = updateSectionName(
      props.fullContent,
      props.section.id,
      newName
    );
    props.setFullContent(newSections);
  };

  // 공통 props (contentEditable, onInput 등)를 묶어둡니다.
  const commonProps = {
    contentEditable: true,
    ref: titleRef,
    className: "section-title" as const,
    onInput: () => {
      handleTitleEdit(
        titleRef.current?.innerText
      );
    },
  };

  switch (props.depth) {
    case 0:
      return <h1 {...commonProps}>{props.content}</h1>;
    case 1:
      return <h2 {...commonProps}>{props.content}</h2>;
    case 2:
      return <h3 {...commonProps}>{props.content}</h3>;
    case 3:
      return <h4 {...commonProps}>{props.content}</h4>;
    case 4:
      return <h5 {...commonProps}>{props.content}</h5>;
    case 5:
      return <h6 {...commonProps}>{props.content}</h6>;
    default:
      return <p {...commonProps}>{props.content}</p>;
  }
};

export default DepthContent;
