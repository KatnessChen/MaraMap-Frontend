import { ChatCitation, citationHref, formatMessageTime, splitAnswer, splitBlocks } from "./chatCitations";

describe("splitBlocks", () => {
  it("separates quoted lines from the assistant's own text", () => {
    expect(splitBlocks("作者提到：\n> 雙腿開始抽筋 [a1b2c3d4]\n之後走到終點。")).toEqual([
      { type: "paragraph", text: "作者提到：" },
      { type: "quote", text: "雙腿開始抽筋 [a1b2c3d4]" },
      { type: "paragraph", text: "之後走到終點。" },
    ]);
  });

  it("joins consecutive quote lines into one block", () => {
    expect(splitBlocks("> 第一句\n> 第二句")).toEqual([{ type: "quote", text: "第一句\n第二句" }]);
  });

  it("accepts a full-width marker and a missing space", () => {
    expect(splitBlocks("＞第一句\n>第二句")).toEqual([{ type: "quote", text: "第一句\n第二句" }]);
  });

  it("does not treat a > in the middle of a line as a quote", () => {
    expect(splitBlocks("配速 5:30 > 6:00")).toEqual([{ type: "paragraph", text: "配速 5:30 > 6:00" }]);
  });

  it("drops the blank lines around a quote but keeps those inside a paragraph", () => {
    expect(splitBlocks("第一段\n\n第二段\n\n> 引用\n\n結尾")).toEqual([
      { type: "paragraph", text: "第一段\n\n第二段" },
      { type: "quote", text: "引用" },
      { type: "paragraph", text: "結尾" },
    ]);
  });

  it("handles an empty answer", () => {
    expect(splitBlocks("")).toEqual([]);
  });
});

const tokyo: ChatCitation = {
  ref: "a1b2c3d4",
  post_id: "a1b2c3d4-0000-4000-8000-000000000001",
  title: "東京馬拉松",
  event_date: "2019-03-03",
  is_hidden: false,
};
const boston: ChatCitation = {
  ...tokyo,
  ref: "e5f6a7b8",
  post_id: "e5f6a7b8-0000-4000-8000-000000000002",
  title: "波士頓馬拉松",
};

describe("formatMessageTime", () => {
  it("shows the date and a 24-hour time", () => {
    const local = new Date(2026, 10, 4, 14, 5);
    expect(formatMessageTime(local.toISOString()).replace(/\s+/g, " ")).toBe("11/4 14:05");
  });
});

describe("citationHref", () => {
  it("links a public post to its public page", () => {
    expect(citationHref(tokyo)).toBe(`/log/${tokyo.post_id}`);
  });

  it("links a hidden post to the editor", () => {
    expect(citationHref({ ...tokyo, is_hidden: true })).toBe(`/admin/edit/${tokyo.post_id}`);
  });
});

describe("splitAnswer", () => {
  it("numbers citations by their position in the confirmed list", () => {
    expect(splitAnswer("先看 [e5f6a7b8]，再看 [a1b2c3d4]。", [tokyo, boston])).toEqual([
      { type: "text", text: "先看 " },
      { type: "cite", number: 2, citation: boston },
      { type: "text", text: "，再看 " },
      { type: "cite", number: 1, citation: tokyo },
      { type: "text", text: "。" },
    ]);
  });

  it("expands several ids inside one bracket", () => {
    const segments = splitAnswer("兩篇 [a1b2c3d4, e5f6a7b8]", [tokyo, boston]);
    expect(segments.filter((segment) => segment.type === "cite")).toHaveLength(2);
  });

  it("drops an id the backend did not confirm", () => {
    expect(splitAnswer("編造 [deadbeef] 的", [tokyo])).toEqual([
      { type: "text", text: "編造 " },
      { type: "text", text: " 的" },
    ]);
  });

  it("hides every marker while the citation list has not arrived", () => {
    expect(splitAnswer("內容 [a1b2c3d4]", [])).toEqual([{ type: "text", text: "內容 " }]);
  });

  it("hides a marker that has only partly streamed", () => {
    expect(splitAnswer("內容 [a1b2", [tokyo])).toEqual([{ type: "text", text: "內容 " }]);
  });

  it("leaves ordinary brackets alone", () => {
    expect(splitAnswer("[備註] 內容", [])).toEqual([{ type: "text", text: "[備註] 內容" }]);
  });

  it("handles an empty answer", () => {
    expect(splitAnswer("", [tokyo])).toEqual([]);
  });
});
