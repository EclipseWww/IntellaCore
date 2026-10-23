const Spreadsheet = require('../models/Spreadsheet');

// Create a new spreadsheet
exports.createSpreadsheet = async (req, res) => {
    try {
        const { name, data, courseId, lessonId, isPublic, description } = req.body;

        const spreadsheet = new Spreadsheet({
            name: name || '未命名表格',
            data: data || [{ name: 'Sheet1', celldata: [], config: {} }],
            creator: req.user.id,
            courseId: courseId || null,
            lessonId: lessonId || null,
            isPublic: isPublic || false,
            description: description || ''
        });

        await spreadsheet.save();

        res.status(201).json({
            success: true,
            data: spreadsheet
        });
    } catch (error) {
        console.error('Create spreadsheet error:', error);
        res.status(500).json({
            success: false,
            message: '创建表格失败',
            error: error.message
        });
    }
};

// Get all spreadsheets for the current user
exports.getSpreadsheets = async (req, res) => {
    try {
        const { courseId, lessonId } = req.query;

        const query = { creator: req.user.id };
        if (courseId) query.courseId = courseId;
        if (lessonId) query.lessonId = lessonId;

        const spreadsheets = await Spreadsheet.find(query)
            .select('name description isPublic createdAt updatedAt')
            .sort({ updatedAt: -1 });

        res.json({
            success: true,
            data: spreadsheets
        });
    } catch (error) {
        console.error('Get spreadsheets error:', error);
        res.status(500).json({
            success: false,
            message: '获取表格列表失败',
            error: error.message
        });
    }
};

// Get a single spreadsheet by ID
exports.getSpreadsheet = async (req, res) => {
    try {
        const { id } = req.params;

        const spreadsheet = await Spreadsheet.findById(id);

        if (!spreadsheet) {
            return res.status(404).json({
                success: false,
                message: '表格不存在'
            });
        }

        // Check permission: creator or public
        if (spreadsheet.creator.toString() !== req.user.id && !spreadsheet.isPublic) {
            return res.status(403).json({
                success: false,
                message: '无权访问此表格'
            });
        }

        res.json({
            success: true,
            data: spreadsheet
        });
    } catch (error) {
        console.error('Get spreadsheet error:', error);
        res.status(500).json({
            success: false,
            message: '获取表格失败',
            error: error.message
        });
    }
};

// Update a spreadsheet
exports.updateSpreadsheet = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, data, isPublic, description } = req.body;

        const spreadsheet = await Spreadsheet.findById(id);

        if (!spreadsheet) {
            return res.status(404).json({
                success: false,
                message: '表格不存在'
            });
        }

        // Check permission: only creator can update
        if (spreadsheet.creator.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: '无权编辑此表格'
            });
        }

        // Update fields
        if (name !== undefined) spreadsheet.name = name;
        if (data !== undefined) spreadsheet.data = data;
        if (isPublic !== undefined) spreadsheet.isPublic = isPublic;
        if (description !== undefined) spreadsheet.description = description;

        await spreadsheet.save();

        res.json({
            success: true,
            data: spreadsheet
        });
    } catch (error) {
        console.error('Update spreadsheet error:', error);
        res.status(500).json({
            success: false,
            message: '保存表格失败',
            error: error.message
        });
    }
};

// Delete a spreadsheet
exports.deleteSpreadsheet = async (req, res) => {
    try {
        const { id } = req.params;

        const spreadsheet = await Spreadsheet.findById(id);

        if (!spreadsheet) {
            return res.status(404).json({
                success: false,
                message: '表格不存在'
            });
        }

        // Check permission: only creator can delete
        if (spreadsheet.creator.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: '无权删除此表格'
            });
        }

        await Spreadsheet.findByIdAndDelete(id);

        res.json({
            success: true,
            message: '表格已删除'
        });
    } catch (error) {
        console.error('Delete spreadsheet error:', error);
        res.status(500).json({
            success: false,
            message: '删除表格失败',
            error: error.message
        });
    }
};
