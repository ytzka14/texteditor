// TextEditorBlock.tsx

import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { papers } from "./Assets";

const itemsList = papers;

export type TextEditorBlockProps = {
  value: string;                           // 초기 HTML (parseRawToHtml이 이미 적용된 상태)
  onChange: (newHtml: string) => void;     // 블록 내부가 바뀌면 호출
  onSplit: (beforeHtml: string, afterHtml: string) => void; // Enter(중간) → 블록 분할
  onEnterAtEnd: () => void;                // Enter(끝) → 새 블록 요청
  shouldFocus: boolean;                    // 부모가 “이 블록에 포커스해줘!” 요청
};

const TextEditorBlock = (props: TextEditorBlockProps) => {
  const { value, onChange, onSplit, onEnterAtEnd, shouldFocus } = props;

  // contentEditable 영역
  const editorRef = useRef<HTMLDivElement>(null);

  // 팝업 관련 상태
  const [popupOpen, setPopupOpen] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const savedRangeRef = useRef<Range | null>(null);

  // 1) “한 번만” innerHTML 세팅
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = value;
  }, []); // ▶ 빈 배열: 마운트 직후, 단 한 번만 실행.

  // 2) shouldFocus가 true가 되면 커서를 맨 끝으로 보내기
  useEffect(() => {
    if (!shouldFocus) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [shouldFocus]);

  // 3) Plain-text 기준 커서 오프셋 계산 함수 (필요 시에만)
  const getPlainTextOffset = useCallback((container: Element): number => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    let offset = 0;
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          // 텍스트 노드
          if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
          // inline-item (<span class="inline-item">)
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).tagName === "SPAN" &&
            (node as Element).classList.contains("inline-item")
          ) {
            return NodeFilter.FILTER_ACCEPT;
          }
          // <br> 태그
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).tagName === "BR"
          ) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    let walkerNode: Node | null;
    while ((walkerNode = walker.nextNode())) {
      if (walkerNode.nodeType === Node.TEXT_NODE) {
        const textLen = (walkerNode.textContent ?? "").length;
        if (walkerNode === range.startContainer) {
          return offset + range.startOffset;
        }
        offset += textLen;
      } else if (
        walkerNode.nodeType === Node.ELEMENT_NODE &&
        (walkerNode as Element).tagName === "SPAN"
      ) {
        const spanEl = walkerNode as HTMLElement;
        const spanLen = spanEl.innerText.length;
        if (spanEl.contains(range.startContainer)) {
          return getPlainTextOffset(spanEl) + offset;
        }
        offset += spanLen;
      } else if (
        walkerNode.nodeType === Node.ELEMENT_NODE &&
        (walkerNode as Element).tagName === "BR"
      ) {
        if (
          walkerNode === range.startContainer ||
          walkerNode.contains(range.startContainer)
        ) {
          return offset + 1;
        }
        offset += 1;
      }
    }
    return offset;
  }, []);

  // 4) Enter가 블록 끝인지 검사
  const isCursorAtEnd = (): boolean => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    const endRange = document.createRange();
    endRange.selectNodeContents(el);
    endRange.collapse(false);
    return range.compareBoundaryPoints(Range.START_TO_END, endRange) === 0;
  };

  // 5) 사용자 입력이 바뀔 때마다 부모 쪽에 innerHTML을 동기화만 하고, 
  //    절대로 React가 innerHTML을 덮어쓰지 않음
  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML);
  }, [onChange]);

  // 6) 팝업에서 토큰 선택 시 (<span> 삽입 로직)
  const selectItem = useCallback(
    (index: number) => {
      const el = editorRef.current;
      const range = savedRangeRef.current;
      if (!el || !range) return;

      // (1) 슬래시 하나 삭제
      range.setStart(range.startContainer, range.startOffset - 1);
      range.deleteContents();

      // (2) <span class="inline-item">토큰</span> 생성 후 삽입
      const itemSpan = document.createElement("span");
      itemSpan.textContent = itemsList[index];
      itemSpan.contentEditable = "false";
      itemSpan.className = "inline-item";
      range.insertNode(itemSpan);

      // (3) 커서를 토큰 뒤로 이동
      const sel = window.getSelection();
      const newRange = document.createRange();
      newRange.setStartAfter(itemSpan);
      newRange.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(newRange);
      el.focus();

      // (4) “즉시” 부모에게 HTML 동기화
      onChange(el.innerHTML);

      // (5) 팝업 닫기
      setPopupOpen(false);
    },
    [onChange]
  );

  // 7) "/" 키 입력 시 슬래시 삽입 → 커서 뒤로 이동 → popupOpen = true
  const handleSlash = useCallback(() => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;

    // (1) 현재 커서 위치 Range 복제
    const range = sel.getRangeAt(0).cloneRange();
    // (2) 슬래시 문자 삽입
    range.insertNode(document.createTextNode("/"));

    // (3) 커서를 슬래시 바로 뒤로 이동
    const newRange = document.createRange();
    newRange.setStart(range.endContainer, range.endOffset);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    el.focus();

    // (4) savedRangeRef에 슬래시 뒤 Range 저장
    savedRangeRef.current = newRange;

    // (5) 팝업 열기 (한 프레임 뒤에도 DOM을 다시 그리지 않으므로 커서가 흔들리지 않음)
    setTimeout(() => {
      const rect = newRange.getBoundingClientRect();
      const editorRect = el.getBoundingClientRect();
      setPopupPosition({
        x: rect.left - editorRect.left,
        y: rect.bottom - editorRect.top,
      });
      setSelectedIndex(0);
      setPopupOpen(true);
    }, 0);
  }, []);

  // 8) 키다운 핸들러: 팝업 내 네비게이션 + Enter 시 블록 분할/새 블록
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // (1) 팝업이 열려 있는 동안: ArrowUp/Down/Enter/Escape 처리
      if (popupOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % itemsList.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + itemsList.length) % itemsList.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          selectItem(selectedIndex);
        } else if (e.key === "Escape") {
          e.preventDefault();
          setPopupOpen(false);
        }
        return;
      }

      // (2) Enter 키: 블록 끝이면 새 블록, 아니라면 split
      if (e.key === "Enter") {
        e.preventDefault();
        const el = editorRef.current;
        const sel = window.getSelection();
        if (!el || !sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);

        if (isCursorAtEnd()) {
          onEnterAtEnd();
        } else {
          const beforeRange = document.createRange();
          beforeRange.setStart(el, 0);
          beforeRange.setEnd(range.startContainer, range.startOffset);

          const afterRange = document.createRange();
          afterRange.selectNodeContents(el);
          afterRange.setStart(range.startContainer, range.startOffset);

          const tempLeft = document.createElement("div");
          tempLeft.appendChild(beforeRange.cloneContents());
          const beforeHtml = tempLeft.innerHTML;

          const tempRight = document.createElement("div");
          tempRight.appendChild(afterRange.cloneContents());
          const afterHtml = tempRight.innerHTML;

          onSplit(beforeHtml, afterHtml);
        }
      }
      // (3) "/" 키: 슬래시 삽입 + 팝업 열기
      else if (e.key === "/") {
        e.preventDefault();
        handleSlash();
      }
    },
    [popupOpen, selectedIndex, selectItem, onEnterAtEnd, onSplit, handleSlash]
  );

  return (
    // position: relative를 주어 popup-list가 이 container를 기준으로 위치하게 함
    <div className="text-editor-block" style={{ position: "relative" }}>
      <div
        ref={editorRef}
        className="editor"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}       // 입력(타이핑, 삭제 등)이 발생할 때
        onKeyDown={handleKeyDown}   // 키다운 이벤트 (엔터/슬래시/팝업 네비 등)
        style={{
          minHeight: "1em",
          outline: "none",
        }}
      />
      {popupOpen && (
        <ul
          className="popup-list"
          style={{
            position: "absolute",
            top: popupPosition.y + 20,
            left: popupPosition.x,
            background: "white",
            border: "1px solid #ccc",
            padding: "4px",
            zIndex: 100,
            listStyle: "none",
            margin: 0,
          }}
        >
          {itemsList.map((item, idx) => (
            <li
              key={item}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(idx);
              }}
              style={{
                padding: "4px 8px",
                cursor: "pointer",
                background: idx === selectedIndex ? "#e0e0e0" : "transparent",
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TextEditorBlock;
