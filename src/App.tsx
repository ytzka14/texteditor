// App.tsx

import "./App.css";
import type { JSX } from "react";
import { useState } from "react";
import { nanoid } from "nanoid";
import type { Section, Block } from "./Assets";
import { text, recursiveParseRawToHtml } from "./Assets";
import TextEditorBlock from "./TextEditorBlock";
import DepthContent from "./DepthContent";

export const App = () => {
  // 섹션들 전체 상태 (중첩 구조, 각 Section.content: Block[]이 HTML 문자열을 담는다)
  const [fullContent, setFullContent] = useState<Section[]>(recursiveParseRawToHtml(text));
  // 어느 블록에 포커스를 줄지 { sectionId, blockId } 또는 null
  const [focusBlock, setFocusBlock] = useState<{
    sectionId: string;
    blockId: string;
  } | null>(null);

  /**
   *  기존 블록 하나( blockId )를 “htmlBefore, htmlAfter” 두 개의 새 블록으로 치환
   *  sectionId: 어느 섹션 안의 블록인지
   *  blockId: 치환할 블록의 ID
   *  htmlBefore: 블록 앞부분에 들어갈 HTML
   *  htmlAfter: 뒤부분에 들어갈 HTML
   */
  const splitBlockInSection = (
    sections: Section[],
    sectionId: string,
    blockId: string,
    htmlBefore: string,
    htmlAfter: string,
    newBlockIdBefore: string,
    newBlockIdAfter: string
  ): Section[] => {
    return sections.map((sec) => {
      if (sec.id === sectionId) {
        const idx = sec.content.findIndex((b) => b.id === blockId);
        if (idx === -1) {
          return sec;
        }
        // 기존 blockId 위치에 두 개의 블록(htmlBefore, htmlAfter)으로 교체
        const newBlocks: Block[] = [
          {
            id: newBlockIdBefore,
            html: htmlBefore,
          },
          {
            id: newBlockIdAfter,
            html: htmlAfter,
          },
        ];
        const updatedContent: Block[] = [
          ...sec.content.slice(0, idx),
          ...newBlocks,
          ...sec.content.slice(idx + 1),
        ];
        return {
          ...sec,
          content: updatedContent,
        };
      }
      // 아니라면 하위 섹션으로 재귀
      return {
        ...sec,
        subsections: splitBlockInSection(
          sec.subsections,
          sectionId,
          blockId,
          htmlBefore,
          htmlAfter,
          newBlockIdBefore,
          newBlockIdAfter
        ),
      };
    });
  };

  /**
   * TextEditorBlock에서 “블록 중간에서 Enter”하려고 할 때 호출되는 콜백
   * → beforeHtml / afterHtml 두 개의 HTML 조각과, 부모는
   *    “원래 블록 하나를 두 개로 쪼개라”고 지시
   */
  const handleSplitBlock = (
    sectionId: string,
    blockId: string,
    beforeHtml: string,
    afterHtml: string
  ) => {
    const newId1 = nanoid();
    const newId2 = nanoid();
    setFullContent((prev) =>
      splitBlockInSection(
        prev,
        sectionId,
        blockId,
        beforeHtml,
        afterHtml,
        newId1,
        newId2
      )
    );
    // “뒤에 만들어진 블록(newId2)에 포커스를 달라”고 요청
    setFocusBlock({ sectionId, blockId: newId2 });
  };

  /**
   * TextEditorBlock에서 “블록 끝에서 Enter”로 새 블록(빈 HTML) 하나 추가를 요청할 때 호출
   */
  const handleAddEmptyBlock = (sectionId: string, blockId: string) => {
    const newId = nanoid();
    // 기존 insertBlockAfter 로직과 동일
    const insertAfter = (
      sections: Section[],
      sectionId: string,
      blockId: string,
      newBlock: Block
    ): Section[] => {
      return sections.map((sec) => {
        if (sec.id === sectionId) {
          const idx = sec.content.findIndex((b) => b.id === blockId);
          if (idx === -1) return sec;
          return {
            ...sec,
            content: [
              ...sec.content.slice(0, idx + 1),
              newBlock,
              ...sec.content.slice(idx + 1),
            ],
          };
        }
        return {
          ...sec,
          subsections: insertAfter(
            sec.subsections,
            sectionId,
            blockId,
            newBlock
          ),
        };
      });
    };
    const emptyBlock: Block = { id: newId, html: "" };
    setFullContent((prev) =>
      insertAfter(prev, sectionId, blockId, emptyBlock)
    );
    setFocusBlock({ sectionId, blockId: newId });
  };

  /**
   * 블록 내용(HTML)이 바뀌었을 때 호출되는 콜백
   * → sectionId, blockId, newHtml을 받아 상태 갱신
   */
  const handleBlockChange = (
    sectionId: string,
    blockId: string,
    newHtml: string
  ) => {
    const updateHtml = (sections: Section[]): Section[] => {
      return sections.map((sec) => {
        if (sec.id === sectionId) {
          const newContent = sec.content.map((blk) =>
            blk.id === blockId ? { ...blk, html: newHtml } : blk
          );
          return { ...sec, content: newContent };
        }
        return {
          ...sec,
          subsections: updateHtml(sec.subsections),
        };
      });
    };
    setFullContent((prev) => updateHtml(prev));
  };

  /**
   * 재귀적으로 섹션과 하위 섹션을 렌더
   */
  const renderSections = (
    sections: Section[],
    depth: number
  ): JSX.Element[] => {
    return sections.map((section) => (
      <div key={section.id} className="section">
        <DepthContent
          content={section.name}
          depth={depth}
          section={section}
          fullContent={fullContent}
          setFullContent={setFullContent}
        />
        {section.content.map((blk) => (
          <TextEditorBlock
            key={blk.id}
            value={blk.html}
            onChange={(newHtml) =>
              {handleBlockChange(section.id, blk.id, newHtml)}
            }
            onSplit={(
              beforeHtml: string,
              afterHtml: string
            ) => {handleSplitBlock(section.id, blk.id, beforeHtml, afterHtml)}}
            onEnterAtEnd={() =>
              {handleAddEmptyBlock(section.id, blk.id)}
            }
            shouldFocus={
              focusBlock?.sectionId === section.id &&
              focusBlock.blockId === blk.id
            }
          />
        ))}
        {section.subsections.length > 0 && (
          <div className="subsections">
            {renderSections(section.subsections, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="container">
      <div className="left-side" />
      <div className="right-side">
        <div className="App">{renderSections(fullContent, 0)}</div>
      </div>
    </div>
  );
};

export default App;
