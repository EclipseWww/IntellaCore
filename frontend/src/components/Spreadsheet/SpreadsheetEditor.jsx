import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { Spin, Button, Space, message as antMessage } from 'antd';
import { SaveOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import './SpreadsheetEditor.css';

/**
 * SpreadsheetEditor - 在线表格编辑器组件
 * 基于 FortuneSheet 实现的 Excel 类在线表格
 */
const SpreadsheetEditor = ({
    data,
    onChange,
    onSave,
    readOnly = false,
    loading = false,
    showFormulas = false, // 新增：是否强制显示公式而非计算值
    style = {}
}) => {
    const containerRef = useRef(null);
    const workbookRef = useRef(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 默认空表格数据
    const defaultData = [{
        name: 'Sheet1',
        celldata: [],
        config: {},
        index: 0,
        status: 1,
        order: 0,
        row: 50,
        column: 26,
    }];

    // 处理数据变化 - 只标记有未保存的更改
    const handleChange = useCallback((newData) => {
        if (!readOnly) {
            setHasUnsavedChanges(true);
        }
    }, [readOnly]);

    // 手动保存 - 使用 ref 获取当前数据
    const handleManualSave = async () => {
        if (onSave) {
            setIsSaving(true);
            try {
                // 使用 workbook ref 获取当前完整数据
                let dataToSave = data || defaultData;

                if (workbookRef.current) {
                    // FortuneSheet 的 getAllSheets 方法可以获取所有工作表数据
                    const allSheets = workbookRef.current.getAllSheets?.();
                    if (allSheets && allSheets.length > 0) {
                        dataToSave = allSheets;
                    } else {
                        // 尝试其他方法
                        const sheet = workbookRef.current.getSheet?.();
                        if (sheet) {
                            dataToSave = [sheet];
                        }
                    }
                }

                await onSave(dataToSave);
                setHasUnsavedChanges(false);
                antMessage.success('保存成功');
            } catch (error) {
                console.error('SpreadsheetEditor: Save error:', error);
                antMessage.error('保存失败');
            } finally {
                setIsSaving(false);
            }
        }
    };

    // 将 data 格式转换为 celldata 格式
    const convertDataToCelldata = (dataArray) => {
        if (!dataArray || !Array.isArray(dataArray)) return [];
        const celldata = [];
        dataArray.forEach((row, rowIndex) => {
            if (row && Array.isArray(row)) {
                row.forEach((cell, colIndex) => {
                    if (cell !== null && cell !== undefined) {
                        celldata.push({
                            r: rowIndex,
                            c: colIndex,
                            v: cell
                        });
                    }
                });
            }
        });
        return celldata;
    };

    // 处理单元格数据 - 如果 showFormulas 为 true，将公式显示为文本
    const processCelldataForFormulas = (celldata) => {
        if (!showFormulas || !celldata) return celldata;

        return celldata.map(cell => {
            // 检查单元格是否包含公式
            // FortuneSheet 的 celldata 格式: { r, c, v: { v: value, f: formula, ... } }
            if (cell.v && typeof cell.v === 'object' && cell.v.f) {
                // 将公式显示为单元格值（以 = 开头）
                return {
                    ...cell,
                    v: {
                        ...cell.v,
                        v: '=' + cell.v.f,  // 显示公式文本
                        m: '=' + cell.v.f,  // 显示格式也设为公式
                        f: undefined,       // 移除公式，防止重新计算
                    }
                };
            }
            return cell;
        });
    };

    // 初始化数据 - 确保包含 FortuneSheet 所需的所有字段
    const normalizeSheetData = (sheets) => {
        if (!sheets || sheets.length === 0) return defaultData;

        return sheets.map((sheet, idx) => {
            const hasDataContent = sheet.data && Array.isArray(sheet.data) &&
                sheet.data.some(row => row && Array.isArray(row) && row.some(cell => cell !== null));

            // 如果有 data 内容，转换为 celldata 格式
            let celldata = sheet.celldata || [];
            if (hasDataContent) {
                celldata = convertDataToCelldata(sheet.data);
            }

            // 如果需要显示公式，处理 celldata
            celldata = processCelldataForFormulas(celldata);

            return {
                name: sheet.name || `Sheet${idx + 1}`,
                index: sheet.index ?? idx,
                status: sheet.status ?? 1,
                order: sheet.order ?? idx,
                row: sheet.row || 50,
                column: sheet.column || 26,
                config: sheet.config || {},
                celldata: celldata,
                // 不传 data，只用 celldata
            };
        });
    };

    const initialData = normalizeSheetData(data);

    // 初始化配置
    const workbookConfig = {
        data: initialData,
        onChange: handleChange,
        allowEdit: !readOnly,
        showToolbar: !readOnly,
        showFormulaBar: true, // 始终显示公式栏，方便查看单元格公式
        showSheetTabs: true,
        row: 50,
        column: 26,
        lang: 'zh',
        // 工具栏配置
        showtoolbarConfig: readOnly ? {} : {
            undoRedo: true,
            paintFormat: true,
            currencyFormat: true,
            percentageFormat: true,
            numberDecrease: true,
            numberIncrease: true,
            moreFormats: true,
            font: true,
            fontSize: true,
            bold: true,
            italic: true,
            strikethrough: true,
            underline: true,
            textColor: true,
            fillColor: true,
            border: true,
            mergeCell: true,
            horizontalAlignMode: true,
            verticalAlignMode: true,
            textWrapMode: true,
            textRotateMode: true,
            image: false,
            link: false,
            chart: false,
            postil: false,
            pivotTable: false,
            function: true,
            frozenMode: true,
            sortAndFilter: true,
            conditionalFormat: false,
            dataVerification: false,
            splitColumn: false,
            screenshot: false,
            findAndReplace: true,
            protection: false,
            print: false,
        },
    };

    if (loading) {
        return (
            <div className="spreadsheet-loading">
                <Spin size="large" tip="加载表格中..." />
            </div>
        );
    }

    return (
        <div
            className="spreadsheet-editor-container"
            style={{ height: '600px', ...style }}
            ref={containerRef}
        >
            {/* 保存按钮栏 - 只在非只读模式下显示 */}
            {!readOnly && onSave && (
                <div className="spreadsheet-toolbar" style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #e8e8e8',
                    background: '#fafafa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Space>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleManualSave}
                            loading={isSaving}
                        >
                            保存
                        </Button>
                        {hasUnsavedChanges ? (
                            <span style={{ color: '#faad14', fontSize: '12px' }}>
                                <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                                有未保存的更改
                            </span>
                        ) : (
                            <span style={{ color: '#52c41a', fontSize: '12px' }}>
                                <CheckCircleOutlined style={{ marginRight: 4 }} />
                                已保存
                            </span>
                        )}
                    </Space>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                        提示：编辑完成后请点击保存按钮
                    </span>
                </div>
            )}
            <div className="spreadsheet-editor-wrapper" style={{ height: !readOnly && onSave ? 'calc(100% - 48px)' : '100%' }}>
                <Workbook {...workbookConfig} ref={workbookRef} />
            </div>
        </div>
    );
};

export default SpreadsheetEditor;
