"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, placeholder as placeholderExtension } from "@codemirror/view";
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { tags } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import styles from "./CodeEditor.module.css";

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const luauHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword],
    color: "var(--syntax-keyword)",
  },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "var(--syntax-string)",
  },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--syntax-number)" },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: "var(--syntax-comment)",
    fontStyle: "italic",
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "var(--syntax-func)",
  },
  { tag: [tags.variableName, tags.propertyName], color: "var(--syntax-var)" },
  {
    tag: [tags.operator, tags.punctuation, tags.bracket],
    color: "var(--syntax-punct)",
  },
]);

const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "var(--text)",
      height: "100%",
    },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      fontSize: "0.8125rem",
      lineHeight: "1.6",
      padding: "var(--space-4)",
      caretColor: "var(--text)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--text-mute)",
      border: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--surface-2)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--surface-2)",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--surface-2)",
    },
  },
  { dark: true },
);

export function CodeEditor({ value, onChange, placeholder }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        StreamLanguage.define(lua),
        syntaxHighlighting(luauHighlightStyle),
        editorTheme,
        ...(placeholder ? [placeholderExtension(placeholder)] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    return () => {
      view.destroy();
    };
    // Editor is created once on mount; value only seeds the initial doc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={styles.wrapper} />;
}
