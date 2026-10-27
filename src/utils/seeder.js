// File: src/utils/seeder.js
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Medication = require('../models/Medication.model');
const Prescription = require('../models/Prescription.model');
const QrScanLog = require('../models/QrScanLog.model');

const seedData = async () => {
  try {
    await connectDB();

    // Xóa dữ liệu cũ trước khi tạo mới
    await Medication.deleteMany({});
    await Prescription.deleteMany({});
    await QrScanLog.deleteMany({});

    console.log('[Seeder] Đã làm sạch dữ liệu cũ...');

    // 1. Tạo Danh mục Thuốc kèm Hướng dẫn (Text + Image + Video MP4)
    const medications = await Medication.insertMany([
      {
        code: 'MED_SYMBICORT_160',
        name: 'Symbicort Turbuhaler 160/4.5mcg',
        active_ingredient: 'Budesonide 160mcg / Formoterol 4.5mcg',
        dosage_form: 'Bình hít bột khô (60 liều)',
        unit: 'Bình',
        general_warning:
          'BẮT BUỘC súc miệng kỹ bằng nước sạch và nhổ đi sau mỗi lần hít thuốc để phòng ngừa nấm miệng và khàn giọng.',
        hotline_support: '1900-6868 (Dược Lâm Sàng - Khoa Hô Hấp)',
        guides: [
          {
            step_order: 1,
            title: 'Video hướng dẫn chuẩn thao tác hít Symbicort',
            content_text:
              'Bấm vào nút Play bên dưới để xem video hướng dẫn trực quan từ Dược sĩ bệnh viện.',
            media_type: 'VIDEO_MP4',
            media_url: '/public/media/videos/symbicort-guide.mp4',
            thumbnail_url: '/public/media/images/symbicort-thumb.jpg',
            duration_seconds: 95,
          },
          {
            step_order: 2,
            title: 'Bước 1: Mở nắp và nạp liều thuốc',
            content_text:
              'Vặn và mở nắp màu trắng. Cầm bình hít thẳng đứng (đế đỏ ở dưới). Vặn phần đế màu đỏ hết cỡ sang một bên, sau đó vặn ngược lại hết cỡ cho đến khi nghe tiếng "CÁCH" (Lúc này 1 liều thuốc đã được nạp).',
            media_type: 'IMAGE',
            media_url: '/public/media/images/symbicort-step1.jpg',
          },
          {
            step_order: 3,
            title: 'Bước 2: Thở ra ngoài và Hít thuốc thật sâu',
            content_text:
              'Quay đầu sang hướng khác, thở ra nhẹ nhàng (TUYỆT ĐỐI KHÔNG thổi hơi vào ống hít). Đặt đầu ống ngậm vào giữa hai hàm răng, khép kín môi và HÍT VÀO BẰNG MIỆNG THẬT SÂU VÀ MẠNH.',
            media_type: 'IMAGE',
            media_url: '/public/media/images/symbicort-step2.jpg',
          },
          {
            step_order: 4,
            title: 'Bước 3: Nín thở 10 giây và Súc miệng',
            content_text:
              'Lấy ống hít ra khỏi miệng, nín thở khoảng 5 - 10 giây rồi thở ra nhẹ nhàng. Đậy nắp bình lại. Đi súc miệng ngay bằng nước lọc và nhổ bỏ.',
            media_type: 'TEXT_ONLY',
          },
        ],
      },
      {
        code: 'MED_INSULIN_FLEXPEN',
        name: 'Bút tiêm Insulin Mixtard 30 FlexPen 100IU/ml',
        active_ingredient: 'Insulin Human 30/70',
        dosage_form: 'Hỗn dịch tiêm dưới da (Bút tiêm nạp sẵn 3ml)',
        unit: 'Bút',
        general_warning:
          'Bảo quản bút chưa mở trong ngăn mát tủ lạnh (2-8°C), KHÔNG ĐỂ NGĂN ĐÁ. Bút đang sử dụng bảo quản ở nhiệt độ phòng (<30°C) tối đa 4 tuần.',
        hotline_support: '1900-6868 (Dược Lâm Sàng - Khoa Nội Tiết)',
        guides: [
          {
            step_order: 1,
            title: 'Video hướng dẫn kỹ thuật tiêm Insulin tại nhà an toàn',
            content_text:
              'Video mô tả chi tiết cách lắc trộn thuốc, gắn kim, đuổi khí và tiêm dưới da vùng bụng/đùi.',
            media_type: 'VIDEO_MP4',
            media_url: '/public/media/videos/insulin-flexpen.mp4',
            thumbnail_url: '/public/media/images/insulin-thumb.jpg',
            duration_seconds: 120,
          },
          {
            step_order: 2,
            title: 'Bước 1: Lăn và lắc nhẹ bút tiêm 10 lần',
            content_text:
              'Lăn bút tiêm giữa hai lòng bàn tay 10 lần và di chuyển bút lên xuống 10 lần cho đến khi dịch thuốc bên trong trắng đục đồng nhất.',
            media_type: 'IMAGE',
            media_url: '/public/media/images/insulin-step1.jpg',
          },
          {
            step_order: 3,
            title: 'Bước 2: Gắn kim, xoay chọn liều và tiêm dưới da',
            content_text:
              'Gắn kim mới, xoay nút chọn liều ở đuôi bút đúng số đơn vị (IU) bác sĩ kê. Sát trùng da, đâm kim vuông góc 90 độ, bấm hết nút tiêm và GIỮ NGUYÊN KIM DƯỚI DA ĐẾM TỪ 1 ĐẾN 6 rồi mới rút kim.',
            media_type: 'IMAGE',
            media_url: '/public/media/images/insulin-step2.jpg',
          },
        ],
      },
    ]);

    console.log(`[Seeder] Đã tạo ${medications.length} thuốc mẫu kèm hướng dẫn Text/Ảnh/MP4.`);

    // 2. Tạo 1 Đơn thuốc mẫu có cố định Token để dễ test quét QR
    const samplePrescription = await Prescription.create({
      prescription_code: 'BA20261027_00158',
      master_qr_token: 'p_demo123456', // URL quét cả đơn: http://localhost:3000/q/p_demo123456
      patient: {
        patient_code: 'BN_889900',
        full_name: 'Nguyễn Văn An',
        birth_year: 1958,
      },
      doctor: {
        name: 'BS.CKII Trần Minh Tâm',
        department: 'Khoa Khám Bệnh Đa Khoa',
      },
      diagnosis: 'Hen phế quản mạn tính kèm Đái tháo đường Type 2',
      general_note:
        'Bệnh nhân tái khám sau 14 ngày. Nhớ mang theo vỏ bút tiêm và bình xịt để bác sĩ kiểm tra kỹ thuật sử dụng.',
      items: [
        {
          item_qr_token: 'i_symbicort01', // URL quét riêng lọ Symbicort: http://localhost:3000/q/i_symbicort01
          medication_id: medications[0]._id,
          medication_snapshot: {
            code: medications[0].code,
            name: medications[0].name,
            unit: medications[0].unit,
            dosage_form: medications[0].dosage_form,
          },
          quantity: 1,
          dosage_instruction: 'Sáng hít 2 nhát, Tối hít 2 nhát (cách nhau 12 giờ)',
          usage_timing: 'Dùng hàng ngày cố định giờ, nhớ súc miệng kỹ sau khi hít',
          custom_note: 'Nếu lên cơn khó thở cấp có thể hít thêm 1 nhát cắt cơn.',
        },
        {
          item_qr_token: 'i_insulin02', // URL quét riêng bút tiêm: http://localhost:3000/q/i_insulin02
          medication_id: medications[1]._id,
          medication_snapshot: {
            code: medications[1].code,
            name: medications[1].name,
            unit: medications[1].unit,
            dosage_form: medications[1].dosage_form,
          },
          quantity: 2,
          dosage_instruction: 'Sáng tiêm 12 đơn vị (IU), Chiều tiêm 8 đơn vị (IU)',
          usage_timing: 'Tiêm dưới da vùng bụng trước bữa ăn sáng và tối 15-20 phút',
          custom_note: 'Luôn chuẩn bị sẵn kẹo ngọt phòng khi có dấu hiệu hạ đường huyết (run tay, vã mồ hôi).',
        },
      ],
    });

    console.log('[Seeder] Đã tạo Đơn thuốc mẫu thành công!');
    console.log('------------------------------------------------------------');
    console.log(`- Mã hồ sơ đơn thuốc : ${samplePrescription.prescription_code}`);
    console.log(`- Tên bệnh nhân hiển thị: ${samplePrescription.patient.masked_name}`);
    console.log(`- QR Tổng cả hồ sơ   : ${process.env.BASE_QR_URL}/${samplePrescription.master_qr_token}`);
    console.log(`- QR Lọ thuốc 1      : ${process.env.BASE_QR_URL}/${samplePrescription.items[0].item_qr_token}`);
    console.log(`- QR Lọ thuốc 2      : ${process.env.BASE_QR_URL}/${samplePrescription.items[1].item_qr_token}`);
    console.log('------------------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('[Seeder] Lỗi khi khởi tạo dữ liệu mẫu:', error);
    process.exit(1);
  }
};

seedData();
