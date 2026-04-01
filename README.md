# Personal Expense Tracker

A full-stack personal expense tracker built with Next.js, TypeScript, Supabase, and Vercel.  
This app helps users manage expenses, view spending insights, and track monthly summaries.

## Live App

- Production: https://personal-expense-tracker-delta-eight.vercel.app/
- Preview: <https://personal-expense-tracker-klptxqzfb-indianaeros-projects.vercel.app/>

## Features

- User authentication: sign up, login, logout
- Expense CRUD: add, edit, delete, and view expenses
- Monthly summary reporting
- Charts and dashboard insights
- Light and dark mode
- CI/CD with GitHub Actions
- Preview and production deployments on Vercel

## Tech Stack

- Next.js
- TypeScript
- Supabase
- Tailwind CSS
- Vercel
- Vitest
- Docker
- GitHub Actions

## Project Structure

```bash
app/
components/
lib/
supabase/
__tests__/
docs/
.github/workflows/
```

## Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/indianaero/personal-expense-tracker.git
   cd personal-expense-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Add environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open:
   ```bash
   http://localhost:3000
   ```

## Deployment

This project is deployed with Vercel.

- Production deployment is connected to the main branch.
- Preview deployments are created for changes before production release.

## Testing

Run tests with:

```bash
npm run test
```

## CI/CD

This project includes GitHub Actions workflows for build and deployment automation.

## Screenshots

Add screenshots or GIFs here.

## Author

Built by Jicky Vinoth with Claude Code as an AI development partner.
