# 🛒 E-Commerce Backend API

Production-ready **NestJS** backend powering a complete eCommerce platform with secure authentication, advanced order management, inventory control, shipping integration, and business analytics.

---

## 🌐 Live Demo

**Frontend:** https://www.sumashop.xyz

**Backend API:** https://your-backend-url.up.railway.app

> Replace the Backend API URL after deployment.

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
- Shippo API
- Swagger
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
- Shipping Integration
- Refund Workflow
- Sales Analytics
- Dashboard Statistics

---

# 🧠 Business Logic

Unlike a basic CRUD application, this project includes several real-world business workflows:

- Automatic stock reservation during checkout
- Automatic inventory restoration after order cancellation
- Cash on Delivery (COD) verification workflow
- Fraud risk detection
- Order lifecycle management
- Shipping status synchronization
- Refund processing
- Revenue analytics
- Inventory tracking

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
- Analytics
- Reports

---

# 🏗️ System Architecture

```text
Next.js Frontend
        │
        ▼
     REST API
        │
        ▼
      NestJS
        │
        ▼
   PostgreSQL Database
        │
   ┌─────────────┐
   ▼             ▼
Cloudinary     Shippo API
```

---

# 📂 Project Structure

```text
src
│
├── auth
├── users
├── products
├── categories
├── cart
├── orders
├── payments
├── shipping
├── analytics
├── common
├── uploads
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

### Swagger

_Add Swagger Screenshot Here_

OR

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
| Authentication | ✅ |
| Users | ✅ |
| Products | ✅ |
| Categories | ✅ |
| Orders | ✅ |
| Inventory | ✅ |
| Shipping | ✅ |
| Analytics | ✅ |
| Reports | ✅ |

---

# 📈 Future Improvements

- Email Notifications
- SMS Notifications
- Coupon System
- Wishlist
- Product Reviews
- Multi Vendor Support
- Payment Gateway Integration

---

# 📄 License

© 2026 Fatema Akther. All rights reserved.