import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CreateSubject from './pages/CreateSubject'
import SubjectDetail from './pages/SubjectDetail'
import SharePage from './pages/SharePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateSubject />} />
        <Route path="/subject/:id" element={<SubjectDetail />} />
        <Route path="/share/:token" element={<SharePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App