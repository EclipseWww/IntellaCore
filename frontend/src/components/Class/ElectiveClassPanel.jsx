import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag, Tabs, Popconfirm, message, Alert, Descriptions, Typography } from 'antd';
import { UserAddOutlined, EditOutlined, DeleteOutlined, InboxOutlined, RollbackOutlined, SearchOutlined } from '@ant-design/icons';
import { classAPI } from '../../services/api';
import { formatClassName, parseNewStudents } from '../../utils/className';

const { Text } = Typography;

// 可选年级：近 6 年入学的年级
const gradeOptions = () => {
  const year = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => year - i).map(g => ({ value: g, label: `${g}级` }));
};

/** 新建 / 编辑教学班（社团课、选修课） */
export const ElectiveFormModal = ({ open, editing, onCancel, onSaved }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editing
      ? { title: editing.title, term: editing.term, grades: editing.grades || [], capacity: editing.capacity || 0 }
      : { title: '', term: '', grades: [], capacity: 0 });
  }, [open, editing, form]);

  const submit = async (values) => {
    setSaving(true);
    try {
      const payload = { ...values, type: 'elective' };
      const res = editing
        ? await classAPI.updateClass(editing._id, payload)
        : await classAPI.createClass(payload);
      message.success(editing ? '教学班已更新' : '教学班已创建');
      onSaved(res.data);
    } catch (error) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? '编辑社团 / 选修课' : '新建社团 / 选修课'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={saving}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="社团课、选修课的学生可以来自不同的行政班和年级。学生账号仍属于原来的行政班，这里只管理成员；系统里没有行政班的学生，可以在添加成员时直接新建账号。"
      />
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="title" label="名称" rules={[{ required: true, whitespace: true, message: '请填写名称' }, { max: 40, message: '不超过 40 个字' }]}>
          <Input placeholder="例如：Python 编程社团" />
        </Form.Item>
        <Form.Item name="term" label="学期（可选）">
          <Input placeholder="例如：2026-2027学年第一学期" maxLength={40} />
        </Form.Item>
        <Form.Item name="grades" label="面向年级（可选，仅用于显示）">
          <Select mode="multiple" allowClear options={gradeOptions()} placeholder="不限年级" />
        </Form.Item>
        <Form.Item name="capacity" label="人数上限（0 表示不限）">
          <InputNumber min={0} max={500} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

/** 添加成员：从行政班勾选、按姓名或学号搜索、粘贴学号名单、直接新建没有行政班的学生账号 */
const AddMembersModal = ({ open, cls, memberIds, onCancel, onAdded }) => {
  const [adminClasses, setAdminClasses] = useState([]);
  const [pickClassId, setPickClassId] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [pasted, setPasted] = useState('');
  const [newStudents, setNewStudents] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [tab, setTab] = useState('pick');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected([]); setPasted(''); setNewStudents(''); setDefaultPassword(''); setCandidates([]); setKeyword(''); setPickClassId(null); setTab('pick');
    classAPI.getAvailableClasses()
      .then(res => setAdminClasses((res.data || []).filter(c => c.type !== 'elective')))
      .catch(() => message.error('获取行政班列表失败'));
  }, [open]);

  const search = useCallback(async (classId, kw) => {
    if (!classId && !kw) { setCandidates([]); return; }
    setLoading(true);
    try {
      const res = await classAPI.searchStudentsForElective({ ...(classId && { classId }), ...(kw && { keyword: kw }) });
      setCandidates(res.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || '搜索学生失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const parsedNew = useMemo(() => parseNewStudents(newStudents, defaultPassword), [newStudents, defaultPassword]);

  const createAccounts = async () => {
    if (!parsedNew.length) { message.warning('请填写学生名单'); return; }
    const bad = parsedNew.findIndex(r => !r.username || !r.name);
    if (bad >= 0) { message.warning(`第 ${bad + 1} 行缺少学号或姓名`); return; }
    const noPassword = parsedNew.findIndex(r => r.password.length < 6);
    if (noPassword >= 0) { message.warning(`第 ${noPassword + 1} 行的密码不足 6 位，请填写该行密码或下方的初始密码`); return; }
    setSaving(true);
    try {
      const res = await classAPI.createElectiveStudents(cls._id, parsedNew);
      message.success(res.message);
      onAdded();
    } catch (error) {
      message.error(error.response?.data?.message || '新建失败');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (tab === 'create') { await createAccounts(); return; }
    const usernames = tab === 'paste'
      ? pasted.split(/[\s,，;；、]+/).map(s => s.trim()).filter(Boolean)
      : [];
    const studentIds = tab === 'pick' ? selected : [];
    if (!usernames.length && !studentIds.length) {
      message.warning(tab === 'paste' ? '请粘贴学号' : '请勾选学生');
      return;
    }
    setSaving(true);
    try {
      const res = await classAPI.addElectiveMembers(cls._id, { studentIds, usernames });
      const notFound = res.data?.notFound || [];
      if (notFound.length) {
        Modal.info({ title: res.message, content: `未找到的学号：${notFound.join('、')}` });
      } else {
        message.success(res.message);
      }
      onAdded();
    } catch (error) {
      message.error(error.response?.data?.message || '添加失败');
    } finally {
      setSaving(false);
    }
  };

  const memberSet = useMemo(() => new Set(memberIds.map(String)), [memberIds]);

  return (
    <Modal
      title={`添加成员 - ${formatClassName(cls)}`}
      open={open}
      onCancel={onCancel}
      onOk={submit}
      okText={tab === 'create' ? '新建并加入' : '添加'}
      confirmLoading={saving}
      width={760}
      destroyOnClose
    >
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'pick',
            label: '从行政班选择',
            children: (
              <>
                <Space style={{ marginBottom: 12 }} wrap>
                  <Select
                    style={{ width: 200 }}
                    placeholder="选择行政班"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    value={pickClassId}
                    options={adminClasses.map(c => ({ value: c._id, label: formatClassName(c) }))}
                    onChange={v => { setPickClassId(v || null); search(v, keyword.trim()); }}
                  />
                  <Input.Search
                    style={{ width: 260 }}
                    placeholder="按姓名或学号搜索（可跨班级）"
                    allowClear
                    enterButton={<SearchOutlined />}
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    onSearch={v => search(pickClassId, v.trim())}
                  />
                </Space>
                <Table
                  size="small"
                  rowKey="_id"
                  loading={loading}
                  dataSource={candidates}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  rowSelection={{
                    preserveSelectedRowKeys: true,
                    selectedRowKeys: selected,
                    onChange: keys => setSelected(keys),
                    getCheckboxProps: r => ({ disabled: memberSet.has(String(r._id)) })
                  }}
                  columns={[
                    { title: '学号', dataIndex: 'username' },
                    { title: '姓名', dataIndex: 'name', render: (v, r) => <>{v}{memberSet.has(String(r._id)) && <Tag style={{ marginLeft: 8 }}>已在本班</Tag>}</> },
                    { title: '行政班', dataIndex: 'adminClassName' }
                  ]}
                  locale={{ emptyText: '请选择行政班或输入姓名、学号搜索' }}
                />
                {selected.length > 0 && <Text type="secondary">已勾选 {selected.length} 名学生（换班级或重新搜索后，已勾选的学生仍会保留）</Text>}
              </>
            )
          },
          {
            key: 'paste',
            label: '粘贴学号名单',
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="可以从 Excel 中复制一列学号粘贴进来，每行一个，也可以用逗号或空格分隔。"
                />
                <Input.TextArea rows={10} value={pasted} onChange={e => setPasted(e.target.value)} placeholder={'20240301\n20240302\n20240415'} />
              </>
            )
          },
          {
            key: 'create',
            label: '新建学生账号',
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="用于系统里没有行政班的学生（例如平时不在本机房上信息课的学生）"
                  description="每行一名学生：学号 姓名 密码，用空格、Tab 或逗号分隔（可以从 Excel 复制三列）。不填密码的行使用下面的初始密码。学号已有账号的学生会直接加入本班，姓名和密码不变。新建的学生只属于本教学班，在登录页选择本班登录。"
                />
                <Input.TextArea
                  rows={8}
                  value={newStudents}
                  onChange={e => setNewStudents(e.target.value)}
                  placeholder={'20250101 王小明\n20250102 李小红 abc123'}
                />
                <Space style={{ marginTop: 12 }} align="center" wrap>
                  <span>初始密码：</span>
                  <Input
                    style={{ width: 200 }}
                    value={defaultPassword}
                    onChange={e => setDefaultPassword(e.target.value)}
                    placeholder="至少 6 位"
                    maxLength={72}
                  />
                  {parsedNew.length > 0 && <Text type="secondary">共 {parsedNew.length} 名学生</Text>}
                </Space>
              </>
            )
          }
        ]}
      />
      {cls.capacity > 0 && (
        <Text type="secondary">人数上限 {cls.capacity} 人，当前 {memberIds.length} 人；超出上限的学生不会被添加。</Text>
      )}
    </Modal>
  );
};

/** 教学班详情：基本信息 + 成员管理 */
const ElectiveClassPanel = ({ cls, onChanged, onDeleted }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [seatEditing, setSeatEditing] = useState(null);
  const [seatValue, setSeatValue] = useState('');
  const [accountEditing, setAccountEditing] = useState(null);
  const [accountForm] = Form.useForm();

  const load = useCallback(async () => {
    if (!cls?._id) return;
    setLoading(true);
    try {
      const res = await classAPI.getElectiveMembers(cls._id);
      setMembers(res.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || '获取成员失败');
    } finally {
      setLoading(false);
    }
  }, [cls?._id]);

  useEffect(() => { setSelectedKeys([]); load(); }, [load]);

  const remove = async (ids) => {
    try {
      const res = await classAPI.removeElectiveMembers(cls._id, ids);
      message.success(res.message);
      setSelectedKeys([]);
      await load();
      onChanged();
    } catch (error) {
      message.error(error.response?.data?.message || '移出失败');
    }
  };

  const updateMember = async (studentId, payload, okText) => {
    try {
      await classAPI.updateElectiveMember(cls._id, studentId, payload);
      message.success(okText);
      await load();
      return true;
    } catch (error) {
      message.error(error.response?.data?.message || '修改失败');
      return false;
    }
  };

  const archived = cls.status === 'archived';

  const toggleArchive = () => {
    Modal.confirm({
      title: archived ? '恢复教学班' : '归档教学班',
      content: archived
        ? '恢复后可以重新排课和上课。'
        : '学期结束后归档：学生登录页不再显示该班，课表中该班的课会被移除；成员和学习记录都会保留，以后可以恢复。',
      okText: archived ? '恢复' : '归档',
      onOk: async () => {
        try {
          const res = await classAPI.setElectiveArchived(cls._id, !archived);
          message.success(res.message);
          onChanged();
        } catch (error) {
          message.error(error.response?.data?.message || '操作失败');
        }
      }
    });
  };

  const del = () => {
    Modal.confirm({
      title: `删除“${formatClassName(cls)}”`,
      content: '只删除这个教学班和成员名单，学生账号以及他们的作业、测验、积分等记录都会保留在原来的行政班（没有行政班的学生账号也会保留，但无法再登录，需要时可加入其他教学班）。课表中该班的课也会一并移除。',
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await classAPI.deleteClass(cls._id);
          message.success(res.message || '已删除');
          onDeleted();
        } catch (error) {
          message.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const columns = [
    { title: '学号', dataIndex: 'username', sorter: (a, b) => String(a.username).localeCompare(String(b.username)) },
    { title: '姓名', dataIndex: 'name' },
    {
      title: '行政班',
      dataIndex: 'adminClassName',
      filters: [...new Set(members.map(m => m.adminClassName))].map(v => ({ text: v, value: v })),
      onFilter: (v, r) => r.adminClassName === v
    },
    {
      title: '本班座位',
      dataIndex: 'seatNumber',
      render: (v, r) => (
        <Space size={4}>
          <span>{v || <Text type="secondary">未选</Text>}</span>
          <Button type="link" size="small" onClick={() => { setSeatEditing(r); setSeatValue(v || ''); }}>修改</Button>
        </Space>
      )
    },
    {
      title: '本班绑定 IP',
      dataIndex: 'boundIp',
      render: (v, r) => (
        v
          ? (
            <Space size={4}>
              <span>{v}</span>
              <Popconfirm title="清除后，学生下次在本班登录时会绑定新的电脑" onConfirm={() => updateMember(r._id, { clearBoundIp: true }, '已清除绑定 IP')}>
                <Button type="link" size="small">清除</Button>
              </Popconfirm>
            </Space>
          )
          : <Text type="secondary">首次登录时绑定</Text>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => (
        <Space size={0}>
          {!r.adminClassId && (
            <Button
              type="link"
              size="small"
              onClick={() => { setAccountEditing(r); accountForm.setFieldsValue({ name: r.name, password: '' }); }}
            >
              账号
            </Button>
          )}
          <Popconfirm
            title={r.adminClassId
              ? '将该学生移出本教学班？学生账号和学习记录不受影响'
              : '该学生没有行政班，移出后将无法登录（账号和学习记录保留，以后可以再加入）。确定移出？'}
            onConfirm={() => remove([r._id])}
            okText="移出"
          >
            <Button type="link" danger size="small">移出</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <Card
        title={(
          <Space>
            <span>{formatClassName(cls)}</span>
            <Tag color="purple">社团/选修</Tag>
            {archived && <Tag>已归档</Tag>}
          </Space>
        )}
        extra={(
          <Space>
            <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>编辑信息</Button>
            <Button icon={archived ? <RollbackOutlined /> : <InboxOutlined />} onClick={toggleArchive}>{archived ? '恢复' : '归档'}</Button>
            <Button danger icon={<DeleteOutlined />} onClick={del}>删除</Button>
          </Space>
        )}
        style={{ marginBottom: 16 }}
      >
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="学期">{cls.term || '未填写'}</Descriptions.Item>
          <Descriptions.Item label="面向年级">{cls.grades?.length ? cls.grades.map(g => `${g}级`).join('、') : '不限'}</Descriptions.Item>
          <Descriptions.Item label="人数">{members.length}{cls.capacity > 0 ? ` / ${cls.capacity}` : ''}</Descriptions.Item>
          <Descriptions.Item label="来自">
            {new Set(members.filter(m => m.adminClassId).map(m => String(m.adminClassId))).size} 个行政班
            {members.some(m => !m.adminClassId) && `，${members.filter(m => !m.adminClassId).length} 名无行政班`}
          </Descriptions.Item>
        </Descriptions>
        <Text type="secondary">
          上课、排课、发布课程和作业与行政班相同：在“上课管理”“课表”“课程管理”中选择这个教学班即可。
          本班开始上课时，正在其他班级登录的成员会被要求重新登录到本班。
        </Text>
      </Card>

      <Card
        title="成员名单"
        extra={(
          <Space>
            {selectedKeys.length > 0 && (
              <Popconfirm title={`将选中的 ${selectedKeys.length} 名学生移出本教学班？`} onConfirm={() => remove(selectedKeys)} okText="移出">
                <Button danger>移出选中（{selectedKeys.length}）</Button>
              </Popconfirm>
            )}
            <Button type="primary" icon={<UserAddOutlined />} disabled={archived} onClick={() => setAddOpen(true)}>添加成员</Button>
          </Space>
        )}
      >
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={members}
          columns={columns}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: '还没有成员，点击“添加成员”从各行政班选择学生，或为没有行政班的学生新建账号' }}
        />
      </Card>

      <AddMembersModal
        open={addOpen}
        cls={cls}
        memberIds={members.map(m => m._id)}
        onCancel={() => setAddOpen(false)}
        onAdded={async () => { setAddOpen(false); await load(); onChanged(); }}
      />
      <ElectiveFormModal
        open={editOpen}
        editing={cls}
        onCancel={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); onChanged(); }}
      />
      <Modal
        title={`修改账号 - ${accountEditing?.username || ''}`}
        open={!!accountEditing}
        onCancel={() => setAccountEditing(null)}
        onOk={() => accountForm.submit()}
        destroyOnClose
      >
        <Form
          form={accountForm}
          layout="vertical"
          onFinish={async ({ name, password }) => {
            const payload = { name };
            if (password) payload.password = password;
            if (await updateMember(accountEditing._id, payload, password ? '姓名已保存，密码已重置' : '姓名已保存')) setAccountEditing(null);
          }}
        >
          <Form.Item name="name" label="姓名" rules={[{ required: true, whitespace: true, message: '请填写姓名' }, { max: 20, message: '不超过 20 个字' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="新密码（留空表示不修改）" rules={[{ min: 6, message: '至少 6 位' }, { max: 72, message: '不超过 72 位' }]}>
            <Input placeholder="至少 6 位" />
          </Form.Item>
        </Form>
        <Text type="secondary">该学生没有行政班，账号由本教学班管理。若以后分到了行政班，请管理员在后台修改其所属班级。</Text>
      </Modal>
      <Modal
        title={`修改 ${seatEditing?.name || ''} 在本班的座位`}
        open={!!seatEditing}
        onCancel={() => setSeatEditing(null)}
        onOk={async () => {
          const seat = seatValue.trim().toUpperCase();
          if (seat && !/^[A-Z][1-9][0-9]*$/.test(seat)) { message.error('座位号格式不正确，请输入如 A1、B2 的格式'); return; }
          if (await updateMember(seatEditing._id, { seatNumber: seat || null }, seat ? '座位已更新' : '座位已清空')) setSeatEditing(null);
        }}
      >
        <Input value={seatValue} onChange={e => setSeatValue(e.target.value)} placeholder="如 A1；留空表示清空座位" />
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>只影响本教学班的座位，不影响学生在行政班的座位。</Text>
      </Modal>
    </>
  );
};

export default ElectiveClassPanel;
