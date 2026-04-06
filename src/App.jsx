import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Auth from './pages/Auth'
import CreateSubject from './pages/CreateSubject'
import SubjectDetail from './pages/SubjectDetail'
import SharePage from './pages/SharePage'
import Profile from './pages/Profile'
import Fragments from './pages/Fragments'
import WritingsPage from './pages/WritingsPage'

function ProtectedRoute({ user, children }) {
  if (user === undefined) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">加载中...</div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Navbar />
      <div className="pt-12">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/share/:token" element={<SharePage />} />
          <Route path="/create" element={
            <ProtectedRoute user={user}>
              <CreateSubject />
            </ProtectedRoute>
          } />
          <Route path="/subject/:id" element={
            <ProtectedRoute user={user}>
              <SubjectDetail />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute user={user}>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/fragments" element={
            <ProtectedRoute user={user}>
              <Fragments />
            </ProtectedRoute>
          } />
          <Route path="/subject/:id/writings" element={
            <ProtectedRoute user={user}>
              <WritingsPage />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}