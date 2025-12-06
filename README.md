# SettleRyt 💰

A Malaysian fintech bill-splitting MVP built with Expo and Convex.

## Features

### 🔐 Authentication
- Secure user authentication via Convex Auth
- Protected routes and session management
- Secure token storage with expo-secure-store

### 👥 Friend Graph
- Add and manage friends
- View friend activity and shared expenses
- Friend request system

### 📋 Groups
- Create expense groups (roommates, trips, events)
- Manage group members
- Group-level expense tracking and history

### 🧮 Itemized Splitting
- **Equal Split**: Divide expenses equally among participants
- **Exact Amount**: Specify exact amounts for each person
- **Percentage Split**: Allocate by custom percentages

### 💳 Settlement Simulation
- View consolidated debts and credits
- Optimized settlement suggestions
- Track payment history

## Tech Stack

- **Framework**: Expo (TypeScript, managed workflow, SDK 52)
- **Backend**: Convex (Real-time DB + Auth)
- **UI Library**: Gluestack UI (Dark mode configured)
- **Charts**: react-native-gifted-charts
- **Navigation**: Expo Router
- **Utilities**: lodash, date-fns

## Design System

Dark mode only with professional fintech aesthetics:

| Element | Color |
|---------|-------|
| Background | `#121212` |
| Cards | `#1E1E1E` |
| Primary Accent | `#00A86B` |
| Text Primary | `#FFFFFF` |
| Text Secondary | `#B3B3B3` |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- Convex account

### Installation

```bash
# Install dependencies
npm install

# Start Convex development server
npm run convex:dev

# Start Expo development server
npm start
```

### Environment Setup

1. Create a Convex project at [convex.dev](https://convex.dev)
2. Run `npx convex dev` to link your project
3. Configure authentication in the Convex dashboard

## Project Structure

```
settleryt/
├── app/                 # Expo Router screens
│   ├── _layout.tsx      # Root layout with providers
│   ├── index.tsx        # Home screen
│   └── (tabs)/          # Tab navigation
├── components/          # Reusable UI components
├── convex/              # Convex backend functions
│   ├── schema.ts        # Database schema
│   └── *.ts             # Query/mutation functions
├── types/               # TypeScript interfaces
├── utils/               # Helper functions
└── assets/              # Images and fonts
```

## License

Private - All rights reserved.

