// File: src/controllers/medication.controller.js
const Medication = require('../models/Medication.model');

/**
 * 1. Lấy danh sách toàn bộ thuốc trong kho hướng dẫn (Hỗ trợ tìm kiếm theo mã/tên)
 */
exports.getAllMedications = async (req, res) => {
  try {
    const { keyword, is_active } = req.query;
    const filter = {};

    if (is_active !== undefined) {
      filter.is_active = is_active === 'true';
    }

    if (keyword) {
      const regex = new RegExp(keyword.trim(), 'i');
      filter.$or = [{ code: regex }, { name: regex }, { active_ingredient: regex }];
    }

    const medications = await Medication.find(filter).sort({ updated_at: -1 });
    return res.status(200).json({
      success: true,
      count: medications.length,
      data: medications,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Lấy chi tiết 1 thuốc và toàn bộ các bước hướng dẫn theo ID hoặc Mã thuốc HIS
 */
exports.getMedicationDetail = async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrCode);

    const query = isObjectId
      ? { _id: idOrCode }
      : { code: idOrCode.toUpperCase().trim() };

    const medication = await Medication.findOne(query);
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thuốc trong danh mục hướng dẫn.',
      });
    }

    return res.status(200).json({ success: true, data: medication });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Tạo mới 1 thuốc kèm danh sách các bước hướng dẫn chuẩn
 */
exports.createMedication = async (req, res) => {
  try {
    const {
      code,
      name,
      active_ingredient,
      dosage_form,
      unit,
      general_warning,
      hotline_support,
      guides,
    } = req.body;

    const existing = await Medication.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Mã thuốc ${code} đã tồn tại trong hệ thống.`,
      });
    }

    const medication = await Medication.create({
      code,
      name,
      active_ingredient,
      dosage_form,
      unit,
      general_warning,
      hotline_support,
      guides: Array.isArray(guides) ? guides : [],
    });

    return res.status(201).json({
      success: true,
      message: 'Đã tạo mới thuốc và hướng dẫn sử dụng thành công.',
      data: medication,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 4. Cập nhật thông tin thuốc và các bước hướng dẫn (Text, Ảnh, Video MP4)
 */
exports.updateMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const medication = await Medication.findById(id);

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thuốc cần cập nhật.',
      });
    }

    const updatableFields = [
      'name',
      'active_ingredient',
      'dosage_form',
      'unit',
      'general_warning',
      'hotline_support',
      'guides',
      'is_active',
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        medication[field] = req.body[field];
      }
    });

    await medication.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật hướng dẫn sử dụng thuốc thành công.',
      data: medication,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 5. Upload File Media (Hình ảnh hoặc Video MP4) và trả về URL chuẩn
 */
exports.uploadGuideMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn file Hình ảnh hoặc Video MP4 để tải lên.',
      });
    }

    const isVideo = req.file.mimetype === 'video/mp4';
    const mediaType = isVideo ? 'VIDEO_MP4' : 'IMAGE';

    // Nếu là Video MP4, trả về đường dẫn qua API Streaming để hỗ trợ tua (Range Requests)
    // Nếu là Ảnh, trả về đường dẫn tĩnh để hiển thị trực tiếp
    const mediaUrl = isVideo
      ? `/api/media/videos/${req.file.filename}`
      : `/public/media/images/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      message: 'Tải lên file hướng dẫn thành công.',
      data: {
        filename: req.file.filename,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
        media_type: mediaType,
        media_url: mediaUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
