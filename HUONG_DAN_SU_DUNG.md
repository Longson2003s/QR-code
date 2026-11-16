# TÀI LIỆU HƯỚNG DẪN SỬ DỤNG
## HỆ THỐNG KHO THUỐC HƯỚNG DẪN & IN TEM MÃ QR DÁN HỘP THUỐC

---

## 1. Giới Thiệu Tổng Quan
Hệ thống **QR-MED (Kho Thuốc Hướng Dẫn & In Mã QR Nhỏ Dán Hộp Thuốc)** giúp Khoa Dược / Nhà thuốc bệnh viện:
- Xây dựng **Kho dữ liệu hướng dẫn sử dụng thuốc chuẩn hóa** (hỗ trợ **Văn bản**, **Hình ảnh minh họa từng bước**, và **Video MP4**).
- Cấp tự động cho **mỗi loại thuốc một mã QR ngắn gọn, cố định** (`qr_token`, ví dụ: `m_symbicort`, `m_insulin`, `m_7167d43e`...) để in ra tem nhãn nhỏ dán trực tiếp lên vỏ hộp thuốc, lọ thuốc, bút tiêm, bình hít.
- Giúp bệnh nhân chỉ cần dùng **Camera điện thoại hoặc Zalo** (qua Wi-Fi nội bộ hoặc mạng di động **4G/5G**) quét mã QR trên hộp thuốc để xem ngay cách sử dụng chi tiết.

---

## 2. Địa Chỉ Truy Cập Hệ Thống

| Phân hệ | Đường dẫn truy cập (Mạng nội bộ LAN) | Mạng ngoài (4G/5G Internet) |
| :--- | :--- | :--- |
| **Trang chủ & Trạng thái Tunnel 4G/5G** | `http://10.120.49.40:3000` | Xem link `https://*.trycloudflare.com` hiển thị tại Trang chủ |
| **Cổng Quản trị Kho thuốc & In tem QR** | `http://10.120.49.40:3000/admin` | `https://<ten-mien-tunnel>.trycloudflare.com/admin` |
| **Trang Bệnh nhân quét mã QR hộp thuốc** | `http://10.120.49.40:3000/q/<ma_qr_token>` | `https://<ten-mien-tunnel>.trycloudflare.com/q/<ma_qr_token>` |

---

## 3. Hướng Dẫn Dành Cho Dược Sĩ Quản Trị (`/admin`)

Khi truy cập **`http://10.120.49.40:3000/admin`**, giao diện gồm **3 Tab chức năng chính**:

### 3.1. Tab 1: Xây Dựng Kho Thuốc Hướng Dẫn & In QR Từng Loại

#### A. Thêm loại thuốc mới vào kho
1. Tại cột bên trái (**➕ Thêm Loại Thuốc Mới Vào Kho Hướng Dẫn**), nhập các thông tin:
   - **Mã loại thuốc (`*`):** Mã định danh duy nhất (VD: `MED_SYMBICORT_160`, `MYDRIN-P`...).
   - **Tên thương mại trên hộp thuốc (`*`):** Tên đầy đủ in trên tem và trang hướng dẫn.
   - **Hoạt chất / Hàm lượng:** VD: `Tobramycin (3mg), Dexamethasone (1mg)`.
   - **Dạng bào chế / Quy cách hộp:** VD: `Dung dịch nhỏ mắt`, `Bình hít bột khô`...
   - **Đơn vị tính (`*`):** VD: `Lọ`, `Hộp`, `Tuýp`, `Viên`, `Bút`.
   - **📌 Tóm tắt cách dùng chung:** Hiển thị nổi bật ở đầu trang khi bệnh nhân quét QR và in trên tem cỡ lớn.
   - **❄️ Hướng dẫn bảo quản hộp thuốc:** VD: `Bảo quản ngăn mát tủ lạnh (2°C – 8°C)`.
   - **⚠️ Cảnh báo quan trọng:** Hiển thị khung cảnh báo màu đỏ cho bệnh nhân (VD: `Nhìn mờ sau khi nhỏ thuốc`, `Súc miệng kỹ sau khi hít thuốc`).
2. **Thêm các bước hướng dẫn chi tiết (`+ Thêm Bước Hướng Dẫn`):**
   - Nhập **Số thứ tự bước**, **Tiêu đề bước**, và **Nội dung hướng dẫn chi tiết**.
   - Chọn loại minh họa:
     - `📄 Chỉ Văn Bản (Text)`
     - `🖼️ Hình Ảnh Minh Họa`: Bấm **`📤 Chọn File Ảnh / MP4`** để tải ảnh (`.jpg`, `.png`, `.webp`) từ máy tính lên.
     - `🎬 Video Hướng Dẫn (MP4)`: Bấm **`📤 Chọn File Ảnh / MP4`** để tải video `.mp4` từ máy tính lên (tối đa 100MB).
3. Bấm **`💾 LƯU VÀO KHO THUỐC & TẠO MÃ QR RIÊNG`**.

#### B. Tra cứu, chỉnh sửa, in lẻ và Xuất Excel Kho thuốc
Tại cột bên phải (**📚 Kho Thuốc & Mã QR Từng Loại**):
- **Tìm kiếm nhanh:** Gõ mã thuốc, tên thuốc hoặc hoạt chất vào ô tìm kiếm.
- **📥 Xuất Excel (`.xlsx`):** Bấm nút **`📥 Xuất Excel (.xlsx)`** ở góc trên bên phải danh sách để tải về file `Kho_Thuoc_QR_YYYY-MM-DD.xlsx` gồm đầy đủ 16 cột thông tin (Mã thuốc, Tên thuốc, Mã QR, Link quét QR, Hoạt chất, Cách dùng, Bảo quản, Cảnh báo, Chi tiết các bước HDSD, Lượt quét...).
- **Thao tác trên từng loại thuốc:**
  - **`🖨️ In Mã QR Nhỏ Dán Hộp`**: Mở trang in tem riêng cho loại thuốc đó.
  - **`📱 Xem HDSD`**: Xem thử giao diện hiển thị trên điện thoại khi quét mã QR.
  - **`✏️ Sửa`** / **`🗑️`**: Cập nhật thông tin hướng dẫn hoặc xóa thuốc khỏi kho.

---

### 3.2. Tab 2: Tìm Kiếm & Chọn Nhiều Loại Thuốc Để In Tem Mã QR

Màn hình này được thiết kế chuyên biệt cho Dược sĩ kho khi cần in tem dán lên nhiều loại hộp thuốc cùng lúc:

1. **Số lượng mặc định = `0`:**
   - Khi mở màn hình, tất cả các loại thuốc đều có số lượng in mặc định là **`0`** (chưa chọn thuốc nào).
2. **Tìm kiếm và chọn cộng dồn nhiều loại thuốc:**
   - Gõ tên thuốc, mã thuốc, hoạt chất hoặc mã QR vào thanh tìm kiếm **`🔍 Gõ tên thuốc, mã thuốc...`**.
   - Tích vào ô **Checkbox** ở đầu thẻ thuốc (hoặc bấm nút **`+`**, **`+5`**, hoặc nhập trực tiếp số lượng tem cần in).
   - Xóa từ khóa tìm kiếm để tìm tiếp loại thuốc thứ 2, thứ 3... **Các loại thuốc đã chọn trước đó vẫn được giữ nguyên 100%** và hiển thị trên thanh **`✅ Đã chọn: X loại thuốc • Tổng cộng: Y tem QR sẽ in`**.
   - Có thể bấm **`👁️ Chỉ hiện thuốc đã chọn`** để kiểm tra lại danh sách các thuốc chuẩn bị in, hoặc bấm **`🗑️ Bỏ chọn tất cả (Về 0)`** để làm mới.
3. **Chọn kích thước nhãn in (`📐 Kích thước nhãn in`):**
   - **`Chuẩn 2.85 in x 1.18 in (~72.4x30mm - Tem cuộn nhà thuốc)`** *(Mặc định)*: Vừa khít khổ giấy máy in nhiệt cuộn `2.85 in x 1.18 in`.
   - **`Siêu nhỏ 22x22mm`**: Dán lọ thuốc nhỏ mắt, bút tiêm, vỉ thuốc.
   - **`Nhỏ chuẩn 35x22mm`**: Dán vỏ hộp thuốc tiêu chuẩn.
   - **`Tem vừa 50x30mm`**: Dán hộp thuốc lớn (kèm tóm tắt cách dùng).
4. **Thực hiện in:**
   - Bấm **`🖨️ IN TEM CÁC THUỐC ĐÃ CHỌN`** -> kiểm tra bản xem trước (có thể tìm thêm hoặc chỉnh lại số lượng ngay trên màn hình xem trước) -> bấm **`Ctrl + P`** để in ra máy in tem nhiệt.

---

### 3.3. Tab 3: Thống Kê Lượt Quét QR Từng Loại Thuốc
- Xem **Tổng số loại thuốc trong Kho hướng dẫn** và **Tổng số lượt bệnh nhân đã quét mã QR**.
- Xem bảng thống kê chi tiết số lượt quét của từng loại thuốc và nhật ký thời gian, thiết bị quét gần nhất.

---

## 4. Hướng Dẫn Cài Đặt & Cập Nhật Trên Máy Chủ Windows (`10.120.49.40`)

### 4.1. Cài đặt lần đầu (Clone từ Git)
Mở **CMD (Run as Administrator)** trên máy chủ `10.120.49.40`:
```cmd
cd /d C:\
git clone https://github.com/Longson2003s/QR-code.git
cd QR-code
setup-windows-server.bat
```

### 4.2. Cập nhật phiên bản mới (Giữ nguyên 100% dữ liệu thuốc trong Database)
Mỗi khi có bản cập nhật tính năng mới trên GitHub, trên máy chủ `10.120.49.40` chỉ cần nhấp đúp chạy file:
- **`update-server.bat`**

Script `update-server.bat` sẽ tự động:
1. Tải code mới nhất từ nhánh `main` trên GitHub (`git fetch` & `git reset --hard origin/main`).
2. Giữ nguyên 100% dữ liệu các loại thuốc và mã QR cố định trong MongoDB (`localhost:27017`).
3. Khởi động lại dịch vụ nền qua `PM2` và tạo đường truyền HTTPS 4G/5G (`trycloudflare.com`).
