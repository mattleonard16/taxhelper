# TaxHelper

A tax awareness app that helps people track taxes, scan receipts with AI, and discover deductible expenses.

## Features

- **Track Sales Tax**: Log purchases and see how much sales tax you're paying
- **Track Income Tax**: Record paycheck withholdings to understand your income tax burden
- **Visual Insights**: Charts showing tax trends over time, by type, and by merchant
- **Tax Templates**: Save common tax rates for quick entry
- **Period Summaries**: View tax totals for today, this month, or this year
- **Receipt Scanning**: Upload receipts for automatic OCR + LLM extraction
- **Smart Categorization**: GPT-4 auto-categorizes expenses (Meals, Travel, Office, etc.)
- **Deductible Detection**: AI flags potentially deductible business expenses
- **AI Insights**: Quiet Leaks, Tax Drag, and Spending Spikes detection

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Backend**: Next.js API Routes
- **Database**: Neon Serverless Postgres
- **ORM**: Prisma
- **Auth**: NextAuth.js

## Getting Started

### Prerequisites

- Node.js 18+
- A Neon database (free tier works great)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/taxhelper.git
cd taxhelper
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Create a `.env` file with:

```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Optional: For Google OAuth (see setup instructions below)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: For email sign-in
EMAIL_SERVER="smtp://user:pass@smtp.example.com:587"
EMAIL_FROM="noreply@example.com"

# Optional: Control which auth options appear on the sign-in page
NEXT_PUBLIC_HAS_GOOGLE_AUTH="true"
NEXT_PUBLIC_HAS_EMAIL_AUTH="true"

# Optional: Override insights cache TTL in hours (default: 6)
INSIGHT_CACHE_TTL_HOURS="6"

# Required for LLM-powered receipt extraction
OPENAI_API_KEY="sk-proj-..."
```

4. Run database migrations:

```bash
npx prisma migrate dev
```

5. Start the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

### Development Login

For local testing, use the **Development** sign-in option:
- **Email**: Any email (e.g., `test@example.com`)
- **Password**: `dev`

This creates a local user automatically and only works in development mode.

### Google OAuth Setup (TODO)

To enable Google Sign-In for production:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (dev) and your production URL
7. Copy the Client ID and Client Secret to your `.env` file

## Project Structure

```
src/
├── app/
│   ├── (app)/           # Authenticated routes
│   │   ├── dashboard/   # Main dashboard
│   │   ├── transactions/# Transaction list
│   │   └── templates/   # Tax templates
│   ├── api/             # API routes
│   │   ├── auth/        # NextAuth handlers
│   │   ├── transactions/# CRUD for transactions
│   │   ├── templates/   # CRUD for templates
│   │   └── summary/     # Aggregated data
│   └── auth/            # Auth pages
├── components/
│   ├── dashboard/       # Dashboard components
│   ├── transactions/    # Transaction components
│   └── ui/              # shadcn/ui components
├── lib/
│   ├── prisma.ts        # Prisma client
│   ├── auth.ts          # NextAuth config
│   └── format.ts        # Formatting utilities
└── types/               # TypeScript types
```

## API Endpoints

### Transactions

- `GET /api/transactions` - List transactions (paginated, filterable)
- `POST /api/transactions` - Create a transaction
- `GET /api/transactions/[id]` - Get a single transaction
- `PUT /api/transactions/[id]` - Update a transaction
- `DELETE /api/transactions/[id]` - Delete a transaction

### Summary

- `GET /api/summary` - Get aggregated tax data (totals, by type, timeseries, top merchants)

### Templates

- `GET /api/templates` - List templates
- `POST /api/templates` - Create a template
- `PUT /api/templates/[id]` - Update a template
- `DELETE /api/templates/[id]` - Delete a template

## Database Schema

- **User**: User accounts with preferences
- **Transaction**: Individual tax entries (sales tax, income tax, other)
- **TaxTemplate**: Saved tax rates for quick entry
- **Account/Session**: NextAuth authentication data

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables
4. Deploy!

The Neon serverless driver works perfectly with Vercel's edge functions.

## License

MIT
