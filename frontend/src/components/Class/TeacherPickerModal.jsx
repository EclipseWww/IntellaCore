import React, { useEffect, useState } from 'react';
import { Modal, Select, Checkbox, Alert, message } from 'antd';
import { classAPI } from '../../services/api';

/**
 * 选择教师（教学班共同执教、课程协作教师）。
 * excludeId：不能选的教师（负责教师 / 课程创建者自己）
 * option：可选的附加勾选项 { label, defaultChecked }，勾选结果作为 onSave 的第二个参数
 */
const TeacherPickerModal = ({ open, title, description, value = [], excludeId, option, onCancel, onSave }) => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(value.map(v => String(v._id || v)));
    setChecked(!!option?.defaultChecked);
    setLoading(true);
    classAPI.getTeacherOptions()
      .then(res => setTeachers(res.data || []))
      .catch(() => message.error('获取教师列表失败'))
      .finally(() => setLoading(false));
    // value 每次渲染都是新数组，只在打开时同步
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(selected, checked);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={title} open={open} onCancel={onCancel} onOk={save} confirmLoading={saving} okText="保存" destroyOnClose>
      {description && <Alert type="info" showIcon style={{ marginBottom: 16 }} message={description} />}
      <Select
        mode="multiple"
        style={{ width: '100%' }}
        placeholder="选择教师（可多选，可按姓名搜索）"
        loading={loading}
        value={selected}
        onChange={setSelected}
        optionFilterProp="label"
        options={teachers
          .filter(t => String(t._id) !== String(excludeId))
          .map(t => ({ value: String(t._id), label: `${t.name}（${t.username}）` }))}
      />
      {option && (
        <Checkbox style={{ marginTop: 16 }} checked={checked} onChange={e => setChecked(e.target.checked)}>
          {option.label}
        </Checkbox>
      )}
    </Modal>
  );
};

export default TeacherPickerModal;
