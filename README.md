# 🛒 E-Commerce Backend API

![NestJS](https://img.shields.io/badge/NestJS-v11-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![JWT](https://img.shields.io/badge/Auth-JWT-orange)
![RBAC](https://img.shields.io/badge/Authorization-RBAC-success)
![Shippo](https://img.shields.io/badge/Shippo-Integrated-00B388)
![Stripe](https://img.shields.io/badge/Stripe-Test%20Mode-635BFF)

Production-ready **NestJS** backend powering a complete eCommerce platform with secure authentication, advanced order management, inventory control, shipping integration, and business analytics.

---

## 🌐 Live Demo

**Frontend:** https://www.sumashop.xyz

**Backend API:** https://api.sumashop.xyz



---

# 🚀 Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- JWT Authentication
- Passport.js
- Role Based Access Control (RBAC)
- Cloudinary
- Shippo API & Webhooks
- Stripe (Test Mode / Mock Payment)
- REST API

---

# ✨ Core Features

- Secure JWT Authentication
- Role Based Access Control (RBAC)
- User Management
- Product Management
- Category Management
- Product Variants
- Product Images
- Shopping Cart
- Checkout
- Order Management
- Inventory Management
- Payments (Cash on Delivery + Stripe Test Mode)
- Shipping Integration
- Refund Workflow
- Sales Analytics
- Dashboard Statistics

---

## 🧠 Business Logic

Unlike a basic CRUD application, this project includes several real-world business workflows:

- Automatic stock reservation during checkout
- Automatic inventory restoration after cancellation or refund
- Rule-based fraud risk scoring for Cash on Delivery (COD) orders
- High-risk order review and manual verification workflow
- Order lifecycle management
- Shippo shipping status synchronization
- Refund processing workflow
- Sales and revenue analytics

---

# 📦 API Modules

- Authentication
- Users
- Roles
- Products
- Categories
- Product Variants
- Shopping Cart
- Orders
- Payments
- Shipping
- Inventory
- Fraud Detection
- Analytics
- Dashboard

---

# 🏗️ System Architecture

```text
                    Next.js Frontend
                           │
                           ▼
                  REST API (HTTPS)
                           │
                           ▼
                 NestJS Backend API
                           │
      ┌────────────┬──────────────┬─────────────┐
      ▼            ▼              ▼             ▼
 PostgreSQL   Cloudinary     Shippo API   Stripe (Test Mode)
(Database)   (Image Store)    (Shipping)     (Payments)
```

---

# 📂 Project Structure

```text
src
│
├── common/
├── config/
├── modules/
│   ├── admin/
│   ├── auth/
│   ├── business-settings/
│   ├── cart/
│   ├── categories/
│   ├── couriers/
│   ├── mail/
│   ├── orders/
│   │   └── payments/
│   ├── products/
│   ├── uploads/
│   └── users/
│
├── migrations/
├── app.module.ts
└── main.ts
```

> Update the folder names if your project structure differs.

---

# ⚙️ Installation

```bash
git clone <repository-url>

cd ecommerce-backend

npm install

npm run start:dev
```

---

# 🔑 Environment Variables

Create a `.env` file.

```env
DATABASE_URL=

JWT_SECRET=

SHIPPO_API_KEY=

CLOUDINARY_CLOUD_NAME=

CLOUDINARY_API_KEY=

CLOUDINARY_API_SECRET=
```

> Never commit your real secrets.

---

# 📸 API Preview

<!-- ### Swagger

_Add Swagger Screenshot Here_

OR -->

### Postman

_Add Postman Collection Screenshot Here_

---

# 🔄 Order Workflow

```text
Customer Order
      │
      ▼
Stock Reserved
      │
      ▼
Payment Verification
      │
      ▼
Shippo Shipping
      │
      ▼
Courier Tracking
      │
      ▼
Delivered
      │
      ▼
Inventory Updated
```

---

# 📊 Main Business Modules

| Module | Status |
|---------|--------|
| Authentication (JWT) | ✅ |
| Role-Based Access Control (RBAC) | ✅ |
| Users | ✅ |
| Products | ✅ |
| Categories | ✅ |
| Product Variants | ✅ |
| Shopping Cart | ✅ |
| Orders | ✅ |
| Payments (Cash on Delivery + Stripe Test Mode) | ✅ |
| Shipping (Shippo API) | ✅ |
| Inventory Management | ✅ |
| Fraud Detection | ✅ |
| Sales Analytics | ✅ |
| Admin Dashboard | ✅ |

---

# 📈 Future Improvements

- Email Notifications
- SMS Notifications
- Coupon System
- Wishlist
- Product Reviews
- Multi Vendor Support
- Live Payment Gateway Support

---

# 📄 License

© 2026 Fatema Akther. All rights reserved.