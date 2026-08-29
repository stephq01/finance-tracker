// The nine stages of the money flow, in order. One color each, defined in
// index.css (@theme). This file is the single source of truth for the
// sidebar nav, the routes, and the placeholder pages — add a page component
// per stage as it gets built and swap it in below.

export const stages = [
  { id: 'income',        path: '/income',        label: 'Income & cash flow', color: 'income',    icon: 'Wallet',
    blurb: 'Every income source, net cash flow, and the timing of when money actually lands.' },
  { id: 'spending',      path: '/spending',      label: 'Spending',          color: 'spend',      icon: 'ShoppingCart',
    blurb: 'Logged by type — fixed, variable, discretionary — and by frequency, with a would-I-spend-here-again note.' },
  { id: 'budget',        path: '/budget',        label: 'Budget',            color: 'budget',     icon: 'ClipboardList',
    blurb: 'Budgeted vs. actual, by category and month.' },
  { id: 'emergency',     path: '/emergency',     label: 'Emergency fund',    color: 'emergency',  icon: 'LifeBuoy',
    blurb: 'Target size, current balance, kept separate from everyday savings, with replenishment tracked.' },
  { id: 'savings',       path: '/savings',       label: 'Savings',           color: 'save',       icon: 'PiggyBank',
    blurb: 'Savings rate, goal-based pots, and sinking funds for the irregular annual costs.' },
  { id: 'debt',          path: '/debt',          label: 'Debt',              color: 'debt',       icon: 'CreditCard',
    blurb: 'Balances, interest rates, minimum payments, payoff timeline, debt-to-income ratio.' },
  { id: 'investments',   path: '/investments',   label: 'Investments & ROI', color: 'invest',     icon: 'LineChart',
    blurb: 'Contributions, ROI, realized vs. unrealized gains, and allocation across assets.' },
  { id: 'networth',      path: '/net-worth',     label: 'Net worth',        color: 'worth',      icon: 'Gem',
    blurb: 'Assets minus liabilities, snapshotted over time.' },
  { id: 'subscriptions', path: '/subscriptions', label: 'Subscriptions',    color: 'sub',        icon: 'RefreshCw',
    blurb: 'Every recurring payment, its cycle, and its next renewal — audited on purpose, not by surprise.' },
]
