# Trò Chơi Đua Bi Ziczac Chọn Học Sinh (ZigZag Marble Picker)

Ứng dụng web tương tác đua bi ziczac chọn học sinh ngẫu nhiên, sinh động dành cho giáo viên và lớp học.

## 🚀 Hướng dẫn Đưa Code lên GitHub & Deploy Cloudflare Pages

### Bước 1: Khởi tạo Git & Đẩy Code lên GitHub

1. Tải toàn bộ mã nguồn ứng dụng (hoặc tải file ZIP project).
2. Mở Terminal / Command Prompt tại thư mục dự án và chạy các lệnh:

```bash
# 1. Khởi tạo kho chứa Git
git init

# 2. Thêm tất cả tập tin vào Git
git add .

# 3. Tạo commit đầu tiên
git commit -m "Initial commit - ZigZag Marble Picker App"

# 4. Đổi tên nhánh chính thành main
git branch -M main

# 5. Liên kết với repository GitHub của bạn (thay URL bên dưới bằng repository của bạn)
git remote add origin https://github.com/USERNAME/REPOSITORY_NAME.git

# 6. Đẩy code lên GitHub
git push -u origin main
```

---

### Bước 2: Đăng ký & Deploy lên Cloudflare Pages

1. **Đăng nhập vào Cloudflare**: Truy cập [cloudflare.com](https://cloudflare.com) và đăng nhập (hoặc tạo tài khoản miễn phí).
2. **Vào Cloudflare Pages**:
   - Ở menu bên trái, chọn **Workers & Pages**.
   - Bấm **Create application** (Tạo ứng dụng) ➔ Chuyển sang tab **Pages** ➔ Chọn **Connect to Git** (Kết nối với Git).
3. **Kết nối GitHub**:
   - Ủy quyền cho Cloudflare kết nối tài khoản GitHub của bạn và chọn Repository vừa đẩy lên.
4. **Cấu hình thông số Build (Build settings)**:
   - **Framework preset**: Chọn `Vite` (hoặc `None`).
   - **Build command** (Lệnh build): `npm run build`
   - **Build output directory** (Thư mục đầu ra): `dist`
   - **Node.js Version**: Đặt `NODE_VERSION` = `18` hoặc `20` trong Environment variables nếu cần.
5. **Hoàn tất**: Bấm **Save and Deploy**. 
   - Cloudflare sẽ tự động build ứng dụng và cung cấp cho bạn một đường link miễn phí dạng `https://your-project.pages.dev` cực kỳ nhanh và mượt mà!

---

## 💻 Chạy Dự Án Ở Local (Máy tính cá nhân)

```bash
# Cài đặt dependencies
npm install

# Khởi chạy giao diện phát triển
npm run dev

# Build sản phẩm đóng gói
npm run build
```
