// File: src/utils/seeder.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const Medication = require('../models/Medication.model');
const { generateQrToken } = require('./tokenGenerator');

/**
 * Script đồng bộ & nâng cấp Kho Thuốc Hướng Dẫn AN TOÀN:
 * - TUYỆT ĐỐI KHÔNG XÓA (deleteMany) dữ liệu các loại thuốc đã nhập trong Database.
 * - Tự động cấp bổ sung mã qr_token riêng biệt cho các loại thuốc cũ chưa có qr_token.
 * - Nếu Database đang trống (hoặc thiếu thuốc từ bản sao lưu Server), tự động nạp bổ sung từ server_medications_backup.json.
 */
const seedOrMigrateData = async () => {
  try {
    await connectDB();

    const backupPath = path.join(__dirname, 'server_medications_backup.json');
    let backupMedications = [];
    if (fs.existsSync(backupPath)) {
      const raw = fs.readFileSync(backupPath, 'utf8').replace(/^\uFEFF/, '');
      backupMedications = JSON.parse(raw);
    }

    let insertedCount = 0;
    let updatedTokenCount = 0;

    // 1. Nạp bổ sung các thuốc từ bản backup nếu trong DB chưa có (Không ghi đè thuốc đã có)
    for (const item of backupMedications) {
      const cleanCode = (item.code || '').trim().toUpperCase();
      if (!cleanCode) continue;

      const existing = await Medication.findOne({
        $or: [{ code: cleanCode }, { code: item.code }],
      });

      if (!existing) {
        let token = generateQrToken('m', 4);
        if (cleanCode === 'MED_SYMBICORT_160') token = 'm_symbicort';
        else if (cleanCode === 'MED_INSULIN_FLEXPEN') token = 'm_insulin';

        await Medication.create({
          code: cleanCode,
          qr_token: item.qr_token || token,
          name: item.name,
          active_ingredient: item.active_ingredient || '',
          dosage_form: item.dosage_form || '',
          unit: item.unit || 'Lọ',
          standard_usage: item.standard_usage || '',
          storage_instruction: item.storage_instruction || '',
          general_warning: item.general_warning || '',
          hotline_support: item.hotline_support || '1900-6868 (Tổ Dược Lâm Sàng)',
          guides: Array.isArray(item.guides)
            ? item.guides.map((g, idx) => ({
                step_order: g.step_order || idx + 1,
                title: g.title,
                content_text: g.content_text,
                media_type: g.media_url ? g.media_type : 'TEXT_ONLY',
                media_url: g.media_url || null,
                thumbnail_url: g.thumbnail_url || null,
                duration_seconds: g.duration_seconds || 0,
              }))
            : [],
          is_active: item.is_active !== false,
        });
        insertedCount++;
      }
    }

    // 2. Kiểm tra toàn bộ thuốc hiện có trong DB: Giữ nguyên dữ liệu và cấp qr_token cho thuốc nào chưa có
    const allMeds = await Medication.find({});
    for (const med of allMeds) {
      if (!med.qr_token) {
        let token = generateQrToken('m', 4);
        if (med.code === 'MED_SYMBICORT_160') token = 'm_symbicort';
        else if (med.code === 'MED_INSULIN_FLEXPEN') token = 'm_insulin';

        await Medication.updateOne({ _id: med._id }, { $set: { qr_token: token } });
        updatedTokenCount++;
      }
    }

    const totalNow = await Medication.countDocuments();
    console.log('------------------------------------------------------------');
    console.log(`[Database] Đã giữ nguyên toàn bộ dữ liệu Kho thuốc hiện có!`);
    console.log(`- Tổng số loại thuốc trong Kho : ${totalNow} loại thuốc`);
    console.log(`- Số thuốc nạp bổ sung từ Backup: ${insertedCount}`);
    console.log(`- Số thuốc cũ được cấp thêm QR : ${updatedTokenCount}`);
    console.log('------------------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('[Database] Lỗi khi đồng bộ dữ liệu:', error);
    process.exit(1);
  }
};

seedOrMigrateData();
