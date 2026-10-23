const test = require('node:test');
const assert = require('node:assert/strict');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const { checkAssignmentDownload } = require('./downloadAccess');

test('students can download only their own assignment or preview; staff access remains available', async () => {
  const original = AssignmentSubmission.exists;
  let query;
  AssignmentSubmission.exists = async filter => { query = filter; return filter.student === 'owner'; };
  try {
    await checkAssignmentDownload({ role: 'student', id: 'owner' }, '/uploads/assignment.xlsx');
    assert.equal(query.$or[0]['content.file.filename'], 'assignment.xlsx');
    await assert.rejects(checkAssignmentDownload({ role: 'student', id: 'other' }, '/uploads/assignment.xlsx'), error => error.status === 403);
    await checkAssignmentDownload({ role: 'student', id: 'owner' }, '/uploads/file[1].pdf', true);
    const match = query.$or[0]['content.file.pdfPreviewPath'];
    assert.ok(match.test('uploads/pdf_previews/file[1].pdf')); assert.ok(match.test('uploads\\pdf_previews\\file[1].pdf'));
    assert.equal(match.test('uploads/pdf_previews/file1.pdf'), false);
    AssignmentSubmission.exists = () => { throw new Error('Staff access should not query ownership'); };
    await checkAssignmentDownload({ role: 'teacher', id: 'teacher' }, '/uploads/assignment.xlsx');
    await checkAssignmentDownload({ role: 'admin', id: 'admin' }, '/uploads/assignment.xlsx');
  } finally { AssignmentSubmission.exists = original; }
});
