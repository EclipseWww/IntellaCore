import React, { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView, keymap, Decoration } from '@codemirror/view';
import { EditorState, Compartment, StateEffect, StateField } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * 基于 CodeMirror 6 的 Python 代码编辑器
 * 支持撤销/重做、自动缩进、多行缩进（Tab / Shift+Tab）、括号匹配与补全、错误行高亮。
 * 快捷键：Ctrl/⌘+Enter 运行，Ctrl/⌘+S 保存。
 */

const setErrorLineEffect = StateEffect.define();
const errorLineDecoration = Decoration.line({ class: 'cm-python-error-line' });

const errorLineField = StateField.define({
    create: () => Decoration.none,
    update(decorations, transaction) {
        let next = decorations.map(transaction.changes);
        if (transaction.docChanged) next = Decoration.none;
        for (const effect of transaction.effects) {
            if (!effect.is(setErrorLineEffect)) continue;
            const line = effect.value;
            if (!line || line < 1 || line > transaction.state.doc.lines) {
                next = Decoration.none;
            } else {
                next = Decoration.set([errorLineDecoration.range(transaction.state.doc.line(line).from)]);
            }
        }
        return next;
    },
    provide: field => EditorView.decorations.from(field)
});

const baseTheme = EditorView.theme({
    '&': { height: '100%' },
    '.cm-scroller': { fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace", lineHeight: '1.5' },
    '.cm-python-error-line': { backgroundColor: 'rgba(255, 77, 79, 0.25)' },
    '&.cm-focused': { outline: 'none' }
});

const fontTheme = size => EditorView.theme({ '&': { fontSize: `${size}px` } });
const editableExtensions = readOnly => [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];

const CodeEditor = ({
    value,
    onChange,
    readOnly = false,
    fontSize = 16,
    errorLine = null,
    onCursorLine,
    onRunShortcut,
    onSaveShortcut,
    placeholderText
}) => {
    const containerRef = useRef(null);
    const viewRef = useRef(null);
    const compartments = useRef({ font: new Compartment(), editable: new Compartment() });
    const callbacks = useRef({});
    callbacks.current = { onChange, onCursorLine, onRunShortcut, onSaveShortcut };

    useEffect(() => {
        const { font, editable } = compartments.current;
        const shortcuts = keymap.of([
            {
                key: 'Mod-Enter',
                preventDefault: true,
                run: () => { callbacks.current.onRunShortcut?.(); return true; }
            },
            {
                key: 'Mod-s',
                preventDefault: true,
                run: () => { callbacks.current.onSaveShortcut?.(); return true; }
            },
            indentWithTab
        ]);
        const view = new EditorView({
            parent: containerRef.current,
            state: EditorState.create({
                doc: value || '',
                extensions: [
                    shortcuts,
                    basicSetup,
                    python(),
                    indentUnit.of('    '),
                    EditorState.tabSize.of(4),
                    oneDark,
                    baseTheme,
                    errorLineField,
                    font.of(fontTheme(fontSize)),
                    editable.of(editableExtensions(readOnly)),
                    EditorView.contentAttributes.of({ 'aria-label': placeholderText || 'Python 代码编辑器' }),
                    EditorView.updateListener.of(update => {
                        if (update.docChanged) callbacks.current.onChange?.(update.state.doc.toString());
                        if (update.docChanged || update.selectionSet) {
                            const head = update.state.selection.main.head;
                            callbacks.current.onCursorLine?.(update.state.doc.lineAt(head).number);
                        }
                    })
                ]
            })
        });
        viewRef.current = view;
        return () => {
            view.destroy();
            viewRef.current = null;
        };
        // 编辑器只创建一次，后续属性变化通过下面的 effect 同步
    }, []);

    // 外部修改代码（加载、恢复历史版本、重置）时同步到编辑器
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const current = view.state.doc.toString();
        if ((value || '') !== current) {
            view.dispatch({ changes: { from: 0, to: current.length, insert: value || '' } });
        }
    }, [value]);

    useEffect(() => {
        viewRef.current?.dispatch({ effects: compartments.current.font.reconfigure(fontTheme(fontSize)) });
    }, [fontSize]);

    useEffect(() => {
        viewRef.current?.dispatch({ effects: compartments.current.editable.reconfigure(editableExtensions(readOnly)) });
    }, [readOnly]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const effects = [setErrorLineEffect.of(errorLine)];
        if (errorLine && errorLine <= view.state.doc.lines) {
            effects.push(EditorView.scrollIntoView(view.state.doc.line(errorLine).from, { y: 'center' }));
        }
        view.dispatch({ effects });
    }, [errorLine]);

    return <div ref={containerRef} className="python-code-editor" />;
};

export default CodeEditor;
