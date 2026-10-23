const path = require('path');
const AssignmentSubmission = require('../models/AssignmentSubmission');

async function checkAssignmentDownload(user, absolutePath, preview = false) {
  if (user.role === 'teacher' || user.role === 'admin') return;
  if (user.role !== 'student') throw Object.assign(new Error('无权访问此文件'), { status: 403 });
  const filename = path.basename(absolutePath);
  const field = preview ? 'pdfPreviewPath' : 'filename';
  const value = preview ? new RegExp(`(^|[/\\\\])${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) : filename;
  const allowed = await AssignmentSubmission.exists({ student: user._id || user.id, $or: [
    { [`content.file.${field}`]: value }, { [`previousVersions.content.file.${field}`]: value }
  ] });
  if (!allowed) throw Object.assign(new Error('无权访问此文件'), { status: 403 });
}
module.exports = { checkAssignmentDownload };
