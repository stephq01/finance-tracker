import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import Login from './components/Login'
import Layout from './components/Layout'
import StagePlaceholder from './components/StagePlaceholder'
import Income from './pages/Income'
import Spending from './pages/Spending'
import Budget from './pages/Budget'
import EmergencyFund from './pages/EmergencyFund'
import Savings from './pages/Savings'
import Debt from './pages/Debt'
import Investments from './pages/Investments'
import NetWorth from './pages/NetWorth'
import Subscriptions from './pages/Subscriptions'
import Businesses from './pages/Businesses'
import BusinessDetail from './pages/BusinessDetail'
import { stages } from './lib/stages'

// All 9 finance stages now have real pages.
const builtPages = {
  income: Income,
  spending: Spending,
  budget: Budget,
  emergency: EmergencyFund,
  savings: Savings,
  debt: Debt,
  investments: Investments,
  networth: NetWorth,
  subscriptions: Subscriptions,
}

export default function App() {
  const { session } = useAuth()

  if (session === undefined) {
    return <div className="min-h-screen bg-ink" />
  }

  if (!session) {
    return <Login />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/income" replace />} />
        {stages.map((s) => {
          const Page = builtPages[s.id]
          return (
            <Route
              key={s.id}
              path={s.path}
              element={Page ? <Page /> : <StagePlaceholder stage={s} />}
            />
          )
        })}
        <Route path="/businesses" element={<Businesses />} />
        <Route path="/businesses/:id" element={<BusinessDetail />} />
        <Route path="*" element={<Navigate to="/income" replace />} />
      </Route>
    </Routes>
  )
}
