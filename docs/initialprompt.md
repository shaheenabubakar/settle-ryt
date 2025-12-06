Step 1: Context & Setup (The Correction)
"I am building 'SettleRyt', a Malaysian fintech bill-splitting MVP. Design: Dark Mode only (#121212 bg, #1E1E1E cards, #00A86B accents). Professional, secure fintech feel (like Ryt Bank/Wahed). Tech Stack:

Expo (TypeScript, managed workflow, SDK 52).

Backend: Convex (Real-time DB + Auth).

UI: Gluestack UI (Dark mode config).

Charts: react-native-gifted-charts (For gradients/fintech look).

Navigation: Expo Router.

Task:

Init: npx create-expo-app@latest settleryt --template blank-typescript.

Install: npm install @gluestack-ui/themed @gluestack-style/react react-native-gifted-charts expo-router expo-linking expo-notifications convex lodash date-fns react-native-svg expo-secure-store.

Create .cursorrules: Enforce functional React components, strict TS, use useQuery/useMutation from Convex, and handle all money as 2-decimal floats.

Create README.md listing features: Auth, Friend Graph, Groups, Itemized Splitting (Equal/Exact/%), Settlement simulation.

Set up app/_layout.tsx with GluestackUIProvider and ConvexProvider.

Just set up the environment. Do not write feature code yet."

Step 2: Backend & Schema (15-20 mins)

After accepting Step 1, prompt:

"Now, build Convex backend for SettleRyt.

convex/schema.ts: Tables with v.values:users: { id: v.id(), email: v.string(), username: v.string(), passwordHash: v.string(), name: v.optional(v.string()) } – index username/email.

friends: { userId: v.id('users'), friendId: v.id('users'), status: v.union(v.literal('pending'), v.literal('accepted')) }.

groups: { name: v.string(), members: v.array(v.id('users')), archived: v.boolean() }.

expenses: { groupId: v.id('groups'), payerId: v.id('users'), description: v.string(), items: v.array(v.object({ name: v.string(), amount: v.number(), splits: v.array(v.object({ userId: v.id('users'), share: v.number() })) })), category: v.optional(v.string()) } – validate sum(splits) === amount.

settlements: { fromId: v.id('users'), toId: v.id('users'), amount: v.number(), expenseId: v.optional(v.id('expenses')), timestamp: v.number(), status: v.literal('paid') }.

convex/auth.ts: Mutations – signUp (unique check, dummy hash pw with btoa), signIn (verify hash, return token). Queries: getUser(id).

convex/queries.ts: getDashboard (balances: owed/owe from expenses/settlements), getFriends(userId), getActivity(userId, limit=20), getPendingRequests(userId).

convex/mutations.ts: addFriend(username), acceptFriend(friendId), createGroup(name, members), addExpense(groupId, data – validate splits), settle(amount, toId – create settlement, notify), remind(toId, amount – trigger notif), archiveGroup(id).

Use server-side validation (e.g., sums in actions).

Push to Convex dashboard. Output: All TS files with types/imports."

Why? Backend first ensures data flows right; test queries in Convex console.


Step 3: App Shell (Refined for Speed)
"Build the app shell.

Navigation: Create app/(tabs)/_layout.tsx with tabs: Home (Dashboard), Friends, Activity, Account. Use lucide-react-native for icons.

Auth UI: Create app/auth/login.tsx. Use Gluestack VStack, Input (masked), and Button. Style it to look like a bank login (secure, clean).

Logic: In app/_layout.tsx, check for the Convex Auth token. If missing, redirect to /auth/login.

Components: Create a reusable CurrencyText component that formats numbers to 'RM X.XX'."

Step 4: The "Complex Logic" Trap
The hardest part of this app is the Split Logic (Itemized splits). If you ask for the whole modal at once, the AI often bugs out on the math validation.

Split this into two sub-prompts:

Prompt 4a (The Component):

"Create a robust component called SplitLogic.tsx. It should accept an amount and a list of users. It allows switching between 'Equal', 'Exact Amount', and 'Percentage' tabs. It needs to validate that the splits sum up to the total amount. Return the split data structure on change."

Prompt 4b (The Screen):

"Now build the AddExpense modal. Use the SplitLogic component we just made. Allow the user to add multiple items (e.g., 'Nasi Lemak', 'Teh Tarik'). For each item, use SplitLogic to define who pays what. On submit, call the addExpense mutation."